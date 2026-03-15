import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { handleCapabilities, handleExecute, handleHealth, handleTraces, handleWellKnown } from "./routes.js";
import type {
  CapabilityHttpServer,
  Logger,
  ServerDependencies,
  ServerOptions,
  ServerInfo,
  ServerState,
  RouteContext,
  RouteResult,
} from "./server-types.js";
import { HttpError } from "./server-types.js";
import { sendJson, withMeta, failure } from "./response-builders.js";
import type { JsonResponse } from "./response-builders.js";
import { createTraceWriter, runtimeEvent } from "../trace/index.js";
import { buildPublicManifestSnapshot } from "../manifest/public-manifest.js";

const ROUTES: Record<string, (ctx: RouteContext) => Promise<RouteResult>> = {
  "GET /health": handleHealth,
  "GET /capabilities": handleCapabilities,
  "POST /execute": handleExecute,
  "GET /traces": handleTraces,
  "GET /.well-known/ai-capabilities.json": handleWellKnown,
};

export function createServer(
  deps: ServerDependencies,
  options: ServerOptions = {},
): CapabilityHttpServer {
  const normalized = normalizeServerOptions(options);
  const logger = deps.logger ?? console;
  const unsafeFallbackActive = Boolean(deps.allowUnsafePublicFallback && !deps.publicManifest);
  const publicManifest = deps.publicManifest ?? (unsafeFallbackActive ? buildPublicManifestSnapshot(deps.manifest) : undefined);
  const state: ServerState = {
    manifest: deps.manifest,
    publicManifest,
    runtime: deps.runtime,
    mode: normalized.mode,
    tracesDir: deps.tracesDir,
    logger,
    allowUnsafePublicFallback: unsafeFallbackActive,
  };
  logWellKnownStatus(state, logger);

  const tracer = new TransportTracer(deps.tracesDir);

  const nodeServer = createHttpServer(async (req, res) => {
    const method = (req.method ?? "GET").toUpperCase();
    const url = buildUrl(req.url ?? "/", normalized.host, req.headers.host);
    const path = normalizePath(url.pathname);
    const routeKey = `${method} ${path}`;
    const handler = ROUTES[routeKey];
    const requestTrace = tracer.createRequestTrace();
    const ctx: RouteContext = {
      req,
      url,
      state,
      traceId: requestTrace.traceId,
      recordEvent: requestTrace.record,
    };

    try {
      await requestTrace.record("http.request", `${method} ${path} received`, {
        route: path,
        method,
      });

      if (!handler) {
        throw new HttpError(404, "NOT_FOUND", `Route ${method} ${path} not found`);
      }

      const result = await handler(ctx);
      const payloadWithTrace = withMeta(result.body, {
        traceId: requestTrace.traceId,
      });
      sendJson(res, result.statusCode, payloadWithTrace);
      await requestTrace.record("http.response", `${method} ${path} completed`, {
        statusCode: result.statusCode,
      });
    } catch (error) {
      const httpError = toHttpError(error);
      if (!(error instanceof HttpError)) {
        state.logger.error("[server] unexpected error", error);
      }
      const payload = withMeta(failure(httpError.code, httpError.message), {
        traceId: requestTrace.traceId,
      });
      sendJson(res, httpError.statusCode, payload);
      await requestTrace.record("http.response", `${method} ${path} failed`, {
        statusCode: httpError.statusCode,
        errorCode: httpError.code,
      });
    }
  });

  let currentPort = normalized.port;

  return {
    async listen() {
      currentPort = await listenAsync(nodeServer, normalized.port, normalized.host);
      const info: ServerInfo = { host: normalized.host, port: currentPort, mode: normalized.mode };
      await tracer.logServerStarted(info);
      state.logger.log(`[server] listening on http://${info.host}:${info.port} (mode=${info.mode})`);
      return info;
    },
    async close() {
      await closeAsync(nodeServer);
      state.logger.log("[server] stopped");
    },
    getInfo() {
      return { host: normalized.host, port: currentPort, mode: normalized.mode };
    },
  };
}

function normalizeServerOptions(options: ServerOptions): { host: string; port: number; mode: ServerInfo["mode"] } {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3000;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  const mode = options.mode === "public" ? "public" : "internal";
  return { host, port, mode };
}

function buildUrl(path: string, fallbackHost: string, headerHost?: string): URL {
  const baseHost = headerHost ?? `${fallbackHost}`;
  return new URL(path, `http://${baseHost}`);
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "").replace(/^$/, "/");
  }
  return pathname || "/";
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

function listenAsync(server: ReturnType<typeof createHttpServer>, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      if (address && typeof address === "object") {
        resolve((address as AddressInfo).port);
      } else {
        resolve(port);
      }
    });
  });
}

function closeAsync(server: ReturnType<typeof createHttpServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

class TransportTracer {
  constructor(private readonly tracesDir?: string) {}

  createRequestTrace(): { traceId: string; record: RouteContext["recordEvent"] } {
    const { writer, traceId } = createTraceWriter({ tracesDir: this.tracesDir });
    const record: RouteContext["recordEvent"] = async (eventType, message, data) => {
      await writer.write(
        runtimeEvent(traceId, eventType, message, {
          data,
          requestId: traceId,
        }),
      );
    };
    return { traceId, record };
  }

  async logServerStarted(info: ServerInfo): Promise<void> {
    const { writer, traceId } = createTraceWriter({ tracesDir: this.tracesDir });
    await writer.write(
      runtimeEvent(traceId, "http.server.started", `Listening on http://${info.host}:${info.port}`, {
        data: { mode: info.mode },
      }),
    );
  }
}

function logWellKnownStatus(state: ServerState, logger: Logger): void {
  if (state.publicManifest && !state.allowUnsafePublicFallback) {
    logger.log(
      `[server] well-known: enabled (${state.publicManifest.capabilities.length} public capabilities)`,
    );
    return;
  }
  if (state.publicManifest && state.allowUnsafePublicFallback) {
    (logger.warn ?? logger.log)(
      "[server] well-known: UNSAFE fallback enabled — filtering canonical manifest. Do not use in production.",
    );
    return;
  }
  logger.log("[server] well-known: disabled (no public manifest provided)");
}
