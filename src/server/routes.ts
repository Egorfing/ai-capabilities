import { success, failure } from "./response-builders.js";
import type { RouteContext, RouteResult } from "./server-types.js";
import { HttpError } from "./server-types.js";
import type { JsonValue } from "./server-types.js";
import {
  readJsonBody,
  parseExecutePayload,
  parseCapabilityQuery,
  parseTraceFilter,
} from "./request-parsers.js";
import { filterTraceEvents, readTraceDir } from "../trace/index.js";
import type { CapabilityExecutionResult } from "../types/index.js";
import { buildWellKnownResponse } from "../well-known/index.js";

export async function handleHealth(ctx: RouteContext): Promise<RouteResult> {
  await ctx.recordEvent("http.health", "Health check requested");
  const manifest = ctx.state.mode === "public" && ctx.state.publicManifest ? ctx.state.publicManifest : ctx.state.manifest;
  const data = {
    status: "ok",
    mode: ctx.state.mode,
    manifestVersion: manifest.manifestVersion,
    app: manifest.app,
    timestamp: new Date().toISOString(),
  };
  return { statusCode: 200, body: success(data) };
}

export async function handleCapabilities(ctx: RouteContext): Promise<RouteResult> {
  await ctx.recordEvent("http.capabilities", "Capabilities requested");
  const manifest = ctx.state.mode === "public" && ctx.state.publicManifest ? ctx.state.publicManifest : ctx.state.manifest;
  const query = parseCapabilityQuery(ctx.url.searchParams);
  const filtersApplied = Boolean(query.visibility || query.kind || query.capabilityId);

  let capabilities = manifest.capabilities;
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
    return { statusCode: 200, body: success(manifest) };
  }

  const filteredManifest = {
    manifestVersion: manifest.manifestVersion,
    generatedAt: manifest.generatedAt,
    app: manifest.app,
    defaults: manifest.defaults,
    count: capabilities.length,
    capabilities,
  };

  return { statusCode: 200, body: success(filteredManifest) };
}

export async function handleExecute(ctx: RouteContext): Promise<RouteResult> {
  const body = await readJsonBody(ctx.req);
  const payload = parseExecutePayload(body);

  const capability = ctx.state.manifest.capabilities.find((cap) => cap.id === payload.capabilityId);
  if (!capability) {
    throw new HttpError(404, "CAPABILITY_NOT_FOUND", `Capability "${payload.capabilityId}" not found`);
  }

  if (ctx.state.mode === "public" && capability.policy.visibility !== "public") {
    throw new HttpError(403, "POLICY_DENIED", `Capability "${payload.capabilityId}" is not available in public mode`);
  }

  const executionMode = ctx.state.mode === "public" ? "public" : payload.context.mode ?? ctx.state.mode;
  const allowDestructive = ctx.state.mode === "public" ? false : payload.context.allowDestructive ?? false;
  const permissionScopes = payload.context.permissionScopes;

  const confirmed =
    payload.context.confirmed ?? payload.confirmed ?? (capability.policy.confirmationPolicy === "none" ? true : undefined);

  const request = {
    capabilityId: payload.capabilityId,
    input: payload.input,
    requestId: payload.requestId ?? ctx.traceId,
    confirmed,
  };

  await ctx.recordEvent("http.execute.requested", `Execution requested for ${payload.capabilityId}`, {
    capabilityId: payload.capabilityId,
  });

  let result: CapabilityExecutionResult;
  try {
    result = await ctx.state.runtime.execute(request, {
      mode: executionMode,
      permissionScopes,
      allowDestructive,
    });
  } catch (err) {
    await ctx.recordEvent(
      "http.execute.error",
      `Execution threw for ${payload.capabilityId}: ${err instanceof Error ? err.message : String(err)}`,
      { capabilityId: payload.capabilityId },
    );
    throw new HttpError(500, "RUNTIME_ERROR", "Execution failed");
  }

  const response = mapExecutionResult(result);

  if (result.status === "success") {
    await ctx.recordEvent("http.execute.completed", `Execution succeeded for ${payload.capabilityId}`, {
      capabilityId: payload.capabilityId,
    });
  } else {
    await ctx.recordEvent("http.execute.completed", `Execution finished with status ${result.status}`, {
      capabilityId: payload.capabilityId,
      status: result.status,
    });
  }

  return response;
}

export async function handleTraces(ctx: RouteContext): Promise<RouteResult> {
  if (!ctx.state.tracesDir) {
    return { statusCode: 200, body: success({ items: [], total: 0 }) };
  }

  const filter = parseTraceFilter(ctx.url.searchParams);
  const events = readTraceDir(ctx.state.tracesDir);
  const filtered = filterTraceEvents(events, filter);
  await ctx.recordEvent("http.traces", "Traces listed", {
    count: filtered.length,
  });
  return { statusCode: 200, body: success({ items: filtered, total: filtered.length }) };
}

export async function handleWellKnown(ctx: RouteContext): Promise<RouteResult> {
  await ctx.recordEvent("http.well_known.requested", "Well-known discovery requested");
  const manifest = ctx.state.publicManifest ?? ctx.state.manifest;
  const response = buildWellKnownResponse({
    manifest,
    mode: ctx.state.mode,
    executionEndpoint: { method: "POST", path: "/execute" },
    capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    interactionHints: { toolCalling: true, httpExecution: true, streaming: false },
  });
  await ctx.recordEvent("http.well_known.served", "Well-known served", {
    capabilityCount: response.capabilities.length,
  });
  return { statusCode: 200, body: success(response) };
}

function mapExecutionResult(result: CapabilityExecutionResult): RouteResult {
  const meta = {
    capabilityId: result.capabilityId,
    durationMs: result.durationMs ?? 0,
    status: result.status,
  };

  switch (result.status) {
    case "success":
      return { statusCode: 200, body: success(result.data ?? null, meta) };
    case "denied": {
      const err = result.error ?? { code: "POLICY_DENIED", message: "Execution denied" };
      return { statusCode: 403, body: failure(err.code, err.message, sanitizeDetails(err.code, err.details), meta) };
    }
    case "pending": {
      const err = result.error ?? {
        code: "POLICY_CONFIRMATION_REQUIRED",
        message: "Confirmation required",
      };
      return { statusCode: 409, body: failure(err.code, err.message, sanitizeDetails(err.code, err.details), meta) };
    }
    case "error": {
      const err = result.error ?? { code: "HANDLER_ERROR", message: "Execution failed" };
      const statusCode = errorStatusCode(err.code);
      return { statusCode, body: failure(err.code, err.message, sanitizeDetails(err.code, err.details), meta) };
    }
    default:
      return { statusCode: 500, body: failure("UNKNOWN_STATUS", `Unhandled runtime status: ${result.status}`, undefined, meta) };
  }
}

function sanitizeDetails(code: string, details: unknown): JsonValue | undefined {
  if (details === undefined) return undefined;
  if (code === "HANDLER_ERROR") {
    return undefined;
  }
  return details as JsonValue;
}

function errorStatusCode(code: string): number {
  switch (code) {
    case "CAPABILITY_NOT_FOUND":
    case "HANDLER_NOT_FOUND":
      return 404;
    case "INVALID_INPUT":
      return 400;
    case "POLICY_DENIED":
      return 403;
    case "POLICY_CONFIRMATION_REQUIRED":
      return 409;
    default:
      return 500;
  }
}
