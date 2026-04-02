import type { IncomingMessage } from "node:http";
import { HttpError } from "./server-types.js";
import type { ExecutionMode } from "../runtime/runtime-types.js";
import type { TraceFilter, TraceLevel, TraceStage } from "../trace/trace-types.js";

const BODY_LIMIT_BYTES = 1_000_000; // ~1MB
const VALID_VISIBILITY = new Set(["internal", "public"]);
const VALID_MODES = new Set<ExecutionMode>(["internal", "public"]);
const VALID_TRACE_STAGES: TraceStage[] = ["extract", "enrich", "adapter", "runtime", "policy"];
const VALID_TRACE_LEVELS: TraceLevel[] = ["info", "warning", "error"];

export interface ExecutePayload {
  capabilityId: string;
  input: Record<string, unknown>;
  requestId?: string;
  confirmed?: boolean;
  context: ExecutionContextPayload;
}

export interface ExecutionContextPayload {
  mode?: ExecutionMode;
  permissionScopes?: string[];
  allowDestructive?: boolean;
  confirmed?: boolean;
}

export interface CapabilityQuery {
  visibility?: "internal" | "public";
  kind?: string;
  capabilityId?: string;
}

export async function readJsonBody(req: IncomingMessage, limit = BODY_LIMIT_BYTES): Promise<unknown> {
  const existingBody = (req as any).body;
  if (existingBody !== undefined) {
    return normalizePrefilledBody(existingBody);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buffer.length;
    if (total > limit) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${limit} bytes limit`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

function normalizePrefilledBody(body: unknown): unknown {
  if (Buffer.isBuffer(body)) {
    const raw = body.toString("utf-8");
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
  }

  if (typeof body === "string") {
    if (!body.trim()) return {};
    try {
      return JSON.parse(body);
    } catch {
      throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
  }

  return body;
}

export function parseExecutePayload(body: unknown): ExecutePayload {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "INVALID_REQUEST", "Request body must be an object");
  }

  const MAX_CAPABILITY_ID_LENGTH = 256;
  const capabilityId = body.capabilityId;
  if (typeof capabilityId !== "string" || capabilityId.trim().length === 0) {
    throw new HttpError(400, "INVALID_REQUEST", "capabilityId is required");
  }
  if (capabilityId.trim().length > MAX_CAPABILITY_ID_LENGTH) {
    throw new HttpError(400, "INVALID_REQUEST", `capabilityId exceeds maximum length of ${MAX_CAPABILITY_ID_LENGTH}`);
  }

  const inputRaw = body.input;
  if (inputRaw !== undefined && !isPlainObject(inputRaw)) {
    throw new HttpError(400, "INVALID_REQUEST", "input must be an object");
  }
  const input = (inputRaw as Record<string, unknown> | undefined) ?? {};

  const contextRaw = body.context;
  if (contextRaw !== undefined && !isPlainObject(contextRaw)) {
    throw new HttpError(400, "INVALID_REQUEST", "context must be an object when provided");
  }

  const executionContext = normalizeExecutionContext(contextRaw as Record<string, unknown> | undefined);
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  const confirmed = typeof body.confirmed === "boolean" ? body.confirmed : undefined;

  if (executionContext.confirmed === undefined && typeof body.confirmed === "boolean") {
    executionContext.confirmed = body.confirmed;
  }

  return {
    capabilityId: capabilityId.trim(),
    input,
    requestId,
    confirmed,
    context: executionContext,
  };
}

function normalizeExecutionContext(context: Record<string, unknown> | undefined): ExecutionContextPayload {
  if (!context) return {};
  const result: ExecutionContextPayload = {};

  if (typeof context.mode === "string" && VALID_MODES.has(context.mode as ExecutionMode)) {
    result.mode = context.mode as ExecutionMode;
  }
  if (Array.isArray(context.permissionScopes)) {
    result.permissionScopes = context.permissionScopes
      .filter((scope): scope is string => typeof scope === "string" && scope.trim().length > 0)
      .map((scope) => scope.trim());
  }
  if (typeof context.allowDestructive === "boolean") {
    result.allowDestructive = context.allowDestructive;
  }
  if (typeof context.confirmed === "boolean") {
    result.confirmed = context.confirmed;
  }
  return result;
}

export function parseCapabilityQuery(params: URLSearchParams): CapabilityQuery {
  const query: CapabilityQuery = {};
  const visibility = params.get("visibility");
  if (visibility) {
    if (!VALID_VISIBILITY.has(visibility)) {
      throw new HttpError(400, "INVALID_QUERY", `visibility must be one of: ${Array.from(VALID_VISIBILITY).join(", ")}`);
    }
    query.visibility = visibility as CapabilityQuery["visibility"];
  }

  const kind = params.get("kind");
  if (kind) {
    query.kind = kind;
  }

  const capabilityId = params.get("capabilityId");
  if (capabilityId) {
    query.capabilityId = capabilityId;
  }

  return query;
}

export function parseTraceFilter(params: URLSearchParams): TraceFilter {
  const filter: TraceFilter = {};

  const traceId = params.get("traceId") ?? params.get("trace_id") ?? params.get("trace-id");
  if (traceId) {
    filter.traceId = traceId;
  }

  const stage = params.get("stage");
  if (stage) {
    if (!VALID_TRACE_STAGES.includes(stage as TraceStage)) {
      throw new HttpError(400, "INVALID_QUERY", `stage must be one of: ${VALID_TRACE_STAGES.join(", ")}`);
    }
    filter.stage = stage as TraceStage;
  }

  const level = params.get("level");
  if (level) {
    if (!VALID_TRACE_LEVELS.includes(level as TraceLevel)) {
      throw new HttpError(400, "INVALID_QUERY", `level must be one of: ${VALID_TRACE_LEVELS.join(", ")}`);
    }
    filter.level = level as TraceLevel;
  }

  const capabilityId = params.get("capabilityId") ?? params.get("capability_id");
  if (capabilityId) {
    filter.capabilityId = capabilityId;
  }

  return filter;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
