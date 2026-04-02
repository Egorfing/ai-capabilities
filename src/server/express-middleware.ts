import type { IncomingMessage, ServerResponse } from "node:http";
import { buildWellKnownResponse } from "../well-known/index.js";
import { parseCapabilityQuery, parseExecutePayload, readJsonBody } from "./request-parsers.js";
import { failure, success } from "./response-builders.js";
import type { JsonResponse } from "./response-builders.js";
import { mapExecutionResult } from "./response-utils.js";
import { HttpError, type Logger } from "./server-types.js";
import type { AiCapabilitiesManifest, CapabilityExecutionSpec, CapabilitySource } from "../types/index.js";
import type { CapabilityRuntimeInterface, ExecutionMode } from "../runtime/runtime-types.js";

const DEFAULT_JSON_LIMIT = 1_000_000; // ~1MB
const DEFAULT_RATE_LIMIT_MAX = 60; // requests per window
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

type ManifestProvider = () => Promise<AiCapabilitiesManifest>;

export interface ExpressRequestLike extends IncomingMessage {
  originalUrl?: string;
  baseUrl?: string;
  path?: string;
  body?: unknown;
  protocol?: string;
  get?(name: string): string | undefined;
}

export interface ExpressResponseLike extends ServerResponse {
  status(code: number): ExpressResponseLike;
  json(body: JsonResponse): ExpressResponseLike;
}

export type ExpressNextFunction = (err?: unknown) => void;
export type ExpressRequestHandler = (req: ExpressRequestLike, res: ExpressResponseLike, next: ExpressNextFunction) => void;

interface RoutePaths {
  wellKnown: string;
  execute: string;
  capabilities: string;
}

interface NormalizedMiddlewareOptions {
  runtime: CapabilityRuntimeInterface;
  manifestProvider: ManifestProvider;
  publicManifestOverride?: AiCapabilitiesManifest;
  mode: ExecutionMode;
  basePath: string;
  routes: RoutePaths;
  jsonBodyLimit: number;
  logger: Logger;
  allowUnsafePublicFallback: boolean;
}

export interface RateLimitConfig {
  /** Maximum requests per window. Default: 60. */
  max?: number;
  /** Window duration in milliseconds. Default: 60 000 (1 min). */
  windowMs?: number;
}

export interface AiCapabilitiesMiddlewareOptions {
  runtime: CapabilityRuntimeInterface;
  manifest?: AiCapabilitiesManifest;
  manifestProvider?: () => Promise<AiCapabilitiesManifest> | AiCapabilitiesManifest;
  publicManifest?: AiCapabilitiesManifest;
  mode?: ExecutionMode;
  basePath?: string;
  jsonBodyLimit?: number;
  logger?: Logger;
  allowUnsafePublicFallback?: boolean;
  /** Rate limiting for the /execute endpoint. Set `false` to disable. Default: enabled (60 req/min per IP). */
  rateLimit?: RateLimitConfig | false;
}

type MatchedRoute = "wellKnown" | "execute" | "capabilities";

// ---------------------------------------------------------------------------
// Simple in-memory sliding-window rate limiter (no external dependencies)
// ---------------------------------------------------------------------------
class SlidingWindowRateLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
    // Periodic cleanup every 2 minutes to prevent memory leaks from stale IPs
    this.cleanupTimer = setInterval(() => this.cleanup(), 120_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /** Returns true if the request is allowed, false if rate-limited. */
  check(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let timestamps = this.hits.get(ip);
    if (timestamps) {
      timestamps = timestamps.filter((t) => t > cutoff);
    } else {
      timestamps = [];
    }
    if (timestamps.length >= this.max) {
      this.hits.set(ip, timestamps);
      return false;
    }
    timestamps.push(now);
    this.hits.set(ip, timestamps);
    return true;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [ip, timestamps] of this.hits) {
      const alive = timestamps.filter((t) => t > cutoff);
      if (alive.length === 0) {
        this.hits.delete(ip);
      } else {
        this.hits.set(ip, alive);
      }
    }
  }
}

export function createAiCapabilitiesMiddleware(options: AiCapabilitiesMiddlewareOptions): ExpressRequestHandler {
  const normalized = normalizeOptions(options);

  // Rate limiter for /execute (opt-out with rateLimit: false)
  let rateLimiter: SlidingWindowRateLimiter | null = null;
  if (options.rateLimit !== false) {
    const cfg = typeof options.rateLimit === "object" ? options.rateLimit : {};
    rateLimiter = new SlidingWindowRateLimiter(
      cfg.max ?? DEFAULT_RATE_LIMIT_MAX,
      cfg.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    );
  }

  const handler: ExpressRequestHandler = (req, res, next) => {
    const url = buildRequestUrl(req);
    const method = (req.method ?? "GET").toUpperCase();
    const path = normalizePath(url.pathname);
    const route = matchRoute(method, path, normalized.routes);
    if (!route) {
      return next();
    }

    Promise.resolve()
      .then(async () => {
        const manifest = await normalized.manifestProvider();
        switch (route) {
          case "wellKnown":
            await handleWellKnown(res, normalized, manifest);
            break;
          case "capabilities":
            await handleCapabilities(res, url, normalized, manifest);
            break;
          case "execute":
            if (rateLimiter) {
              const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
                ?? req.socket?.remoteAddress ?? "unknown";
              if (!rateLimiter.check(ip)) {
                throw new HttpError(429, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.");
              }
            }
            await handleExecute(req, res, normalized, manifest);
            break;
          default:
            throw new HttpError(404, "NOT_FOUND", "Route not implemented");
        }
      })
      .catch((error) => {
        handleMiddlewareError(error, res, normalized.logger);
      });
  };

  return handler;
}

async function handleWellKnown(
  res: ExpressResponseLike,
  options: NormalizedMiddlewareOptions,
  manifest: AiCapabilitiesManifest,
): Promise<void> {
  const manifestForDiscovery =
    options.publicManifestOverride ??
    (options.allowUnsafePublicFallback ? buildPublicManifest(manifest) : undefined);
  if (!manifestForDiscovery) {
    throw new HttpError(
      404,
      "PUBLIC_MANIFEST_MISSING",
      "Public manifest not configured. Provide options.publicManifest or enable allowUnsafePublicFallback in non-production environments.",
    );
  }
  const payload = buildWellKnownResponse({
    manifest: manifestForDiscovery,
    mode: options.mode,
    executionEndpoint: { method: "POST", path: options.routes.execute },
    capabilitiesEndpoint: { method: "GET", path: options.routes.capabilities },
    interactionHints: { toolCalling: true, httpExecution: true, streaming: false },
  });
  sendJson(res, 200, success(payload));
}

async function handleCapabilities(
  res: ExpressResponseLike,
  url: URL,
  options: NormalizedMiddlewareOptions,
  manifest: AiCapabilitiesManifest,
): Promise<void> {
  const effectiveManifest =
    options.mode === "public"
      ? options.publicManifestOverride ??
        (options.allowUnsafePublicFallback ? buildPublicManifest(manifest) : undefined)
      : manifest;

  if (options.mode === "public" && !effectiveManifest) {
    throw new HttpError(
      503,
      "PUBLIC_MANIFEST_MISSING",
      "Public manifest not configured. Provide options.publicManifest or enable allowUnsafePublicFallback for development.",
    );
  }
  const manifestToUse = effectiveManifest ?? manifest;

  const query = parseCapabilityQuery(url.searchParams);
  const filtersApplied = Boolean(query.visibility || query.kind || query.capabilityId);
  let capabilities = manifestToUse.capabilities;

  if (query.visibility) {
    capabilities = capabilities.filter((cap) => cap.policy.visibility === query.visibility);
  }
  if (query.kind) {
    capabilities = capabilities.filter((cap) => cap.kind === query.kind);
  }
  if (query.capabilityId) {
    capabilities = capabilities.filter((cap) => cap.id === query.capabilityId);
  }

  if (!filtersApplied) {
    sendJson(res, 200, success(manifestToUse));
    return;
  }

  const filtered = {
    manifestVersion: manifestToUse.manifestVersion,
    generatedAt: manifestToUse.generatedAt,
    app: manifestToUse.app,
    defaults: manifestToUse.defaults,
    count: capabilities.length,
    capabilities,
  };

  sendJson(res, 200, success(filtered));
}

async function handleExecute(
  req: ExpressRequestLike,
  res: ExpressResponseLike,
  options: NormalizedMiddlewareOptions,
  manifest: AiCapabilitiesManifest,
): Promise<void> {
  const body = await readJsonBody(req, options.jsonBodyLimit);
  const payload = parseExecutePayload(body);

  const capability = manifest.capabilities.find((cap) => cap.id === payload.capabilityId);
  if (!capability) {
    throw new HttpError(404, "CAPABILITY_NOT_FOUND", `Capability "${payload.capabilityId}" not found`);
  }

  if (options.mode === "public" && capability.policy.visibility !== "public") {
    throw new HttpError(403, "POLICY_DENIED", `Capability "${payload.capabilityId}" is not available in public mode`);
  }

  const executionMode = options.mode === "public" ? "public" : payload.context.mode ?? options.mode;
  const allowDestructive = options.mode === "public" ? false : payload.context.allowDestructive ?? false;
  const permissionScopes = payload.context.permissionScopes;
  const confirmed =
    payload.context.confirmed ?? payload.confirmed ?? (capability.policy.confirmationPolicy === "none" ? true : undefined);

  const requestId = payload.requestId ?? createRequestId();
  const request = {
    capabilityId: payload.capabilityId,
    input: payload.input,
    requestId,
    confirmed,
  };

  let result;
  try {
    result = await options.runtime.execute(request, {
      mode: executionMode,
      permissionScopes,
      allowDestructive,
    });
  } catch (error) {
    options.logger.error("[ai-capabilities] runtime execution failed", error);
    throw new HttpError(500, "RUNTIME_ERROR", "Execution failed");
  }

  const response = mapExecutionResult(result);
  sendJson(res, response.statusCode, response.body);
}

function normalizeOptions(options: AiCapabilitiesMiddlewareOptions): NormalizedMiddlewareOptions {
  if (!options.runtime) {
    throw new Error("createAiCapabilitiesMiddleware requires a runtime");
  }
  const mode: ExecutionMode = options.mode === "public" ? "public" : "internal";
  const allowUnsafePublicFallback = Boolean(options.allowUnsafePublicFallback);
  if (mode === "public" && !options.publicManifest && !allowUnsafePublicFallback) {
    throw new Error(
      "createAiCapabilitiesMiddleware in public mode requires options.publicManifest. Generate one or enable allowUnsafePublicFallback for development only.",
    );
  }

  const manifestProvider = createManifestProvider(options);
  const basePath = normalizeBasePath(options.basePath);
  const routes = {
    wellKnown: joinPath(basePath, "/.well-known/ai-capabilities.json"),
    capabilities: joinPath(basePath, "/capabilities"),
    execute: joinPath(basePath, "/execute"),
  };

  return {
    runtime: options.runtime,
    manifestProvider,
    publicManifestOverride: options.publicManifest,
    mode,
    basePath,
    routes,
    jsonBodyLimit: options.jsonBodyLimit ?? DEFAULT_JSON_LIMIT,
    logger: options.logger ?? console,
    allowUnsafePublicFallback,
  };
}

function createManifestProvider(options: AiCapabilitiesMiddlewareOptions): ManifestProvider {
  if (options.manifest) {
    const manifest = options.manifest;
    return async () => manifest;
  }

  if (options.manifestProvider) {
    return async () => await options.manifestProvider!();
  }

  return async () => options.runtime.getManifest();
}

function normalizeBasePath(path?: string): string {
  if (!path || path === "/") return "";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

function joinPath(base: string, segment: string): string {
  if (!segment.startsWith("/")) {
    segment = `/${segment}`;
  }
  if (!base) {
    return segment === "/" ? "/" : segment;
  }
  if (segment === "/") {
    return base;
  }
  return `${base}${segment}`;
}

function matchRoute(method: string, path: string, routes: RoutePaths): MatchedRoute | null {
  if (method === "GET" && path === routes.wellKnown) return "wellKnown";
  if (method === "GET" && path === routes.capabilities) return "capabilities";
  if (method === "POST" && path === routes.execute) return "execute";
  return null;
}

function buildRequestUrl(req: ExpressRequestLike): URL {
  const originalUrl = req.originalUrl ?? req.url ?? "/";
  const hostHeader = typeof req.headers?.host === "string" ? req.headers.host : "localhost";
  const protocol = req.protocol ?? "http";
  const base = `${protocol}://${hostHeader}`;
  try {
    return new URL(originalUrl, base);
  } catch {
    return new URL(originalUrl, "http://localhost");
  }
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "").replace(/^$/, "/");
  }
  return pathname || "/";
}

function sendJson(res: ExpressResponseLike, statusCode: number, payload: JsonResponse): void {
  res.status(statusCode).json(payload);
}

function handleMiddlewareError(error: unknown, res: ExpressResponseLike, logger: Logger): void {
  const httpError = toHttpError(error);
  if (!(error instanceof HttpError)) {
    logger.error("[ai-capabilities] middleware error", error);
  }
  sendJson(res, httpError.statusCode, failure(httpError.code, httpError.message));
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof Error) {
    return new HttpError(500, "INTERNAL_ERROR", error.message);
  }
  return new HttpError(500, "INTERNAL_ERROR", "Internal server error");
}

function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPublicManifest(manifest: AiCapabilitiesManifest): AiCapabilitiesManifest {
  const capabilities = manifest.capabilities
    .filter((cap) => cap.policy.visibility === "public")
    .map((cap) => sanitizeCapabilityForPublic(cap));

  return {
    manifestVersion: manifest.manifestVersion,
    generatedAt: manifest.generatedAt,
    app: { ...manifest.app },
    defaults: { ...manifest.defaults },
    capabilities,
  };
}

function sanitizeCapabilityForPublic(cap: AiCapabilitiesManifest["capabilities"][number]) {
  return {
    ...cap,
    execution: sanitizeExecution(cap.execution),
    sources: cap.sources?.map((source) => sanitizeSource(source)),
    diagnostics: undefined,
    metadata: undefined,
  };
}

function sanitizeExecution(execution?: CapabilityExecutionSpec): CapabilityExecutionSpec | undefined {
  if (!execution) return undefined;
  const sanitized: CapabilityExecutionSpec = { ...execution };
  delete (sanitized as { handlerRef?: string }).handlerRef;
  return sanitized;
}

function sanitizeSource(source: CapabilitySource): CapabilitySource {
  return { type: source.type };
}
