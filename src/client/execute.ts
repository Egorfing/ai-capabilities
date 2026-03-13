import { AiCapabilitiesClientError } from "./errors.js";
import { requestJson, resolveEndpoint } from "./http.js";
import type { ExecuteCapabilityOptions, ExecutionContextOptions, ExecuteCapabilityResult } from "./types.js";
import type { CapabilityExecutionResult } from "../types/index.js";

const EXECUTE_PATH = "/execute";

export async function executeCapability(
  baseUrl: string,
  capabilityId: string,
  input: Record<string, unknown> = {},
  options?: ExecuteCapabilityOptions,
): Promise<ExecuteCapabilityResult> {
  if (typeof capabilityId !== "string" || capabilityId.trim().length === 0) {
    throw new AiCapabilitiesClientError("capabilityId is required");
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new AiCapabilitiesClientError("input must be an object");
  }

  const url = resolveEndpoint(baseUrl, EXECUTE_PATH);
  const payload = {
    capabilityId: capabilityId.trim(),
    input,
    requestId: options?.requestId,
    confirmed: options?.confirmed,
    context: normalizeExecutionContext(options?.context),
  };

  const response = await requestJson<unknown>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    options,
  );

  return mapEnvelopeToResult(response.envelope, response.response.status, capabilityId, options);
}

function normalizeExecutionContext(context?: ExecutionContextOptions): Record<string, unknown> {
  if (!context) return {};
  const normalized: Record<string, unknown> = {};
  if (context.mode) {
    normalized.mode = context.mode;
  }
  if (Array.isArray(context.permissionScopes) && context.permissionScopes.length > 0) {
    normalized.permissionScopes = context.permissionScopes;
  }
  if (typeof context.allowDestructive === "boolean") {
    normalized.allowDestructive = context.allowDestructive;
  }
  if (typeof context.confirmed === "boolean") {
    normalized.confirmed = context.confirmed;
  }
  return normalized;
}

function mapEnvelopeToResult(
  envelope: { status: string; data?: unknown; error?: { code: string; message: string; details?: unknown }; meta?: Record<string, unknown> },
  statusCode: number,
  fallbackCapabilityId: string,
  options?: ExecuteCapabilityOptions,
): CapabilityExecutionResult {
  const capabilityId = (envelope.meta?.capabilityId as string | undefined) ?? fallbackCapabilityId;
  const durationMs = typeof envelope.meta?.durationMs === "number" ? envelope.meta.durationMs : undefined;
  const statusMeta = envelope.meta?.status;
  const status =
    typeof statusMeta === "string"
      ? (statusMeta as CapabilityExecutionResult["status"])
      : envelope.status === "success"
        ? "success"
        : "error";

  if (envelope.status === "success") {
    return {
      capabilityId,
      requestId: options?.requestId,
      status,
      data: envelope.data,
      durationMs,
    };
  }

  const error = envelope.error ?? { code: "HTTP_ERROR", message: `Request failed with status ${statusCode}` };
  return {
    capabilityId,
    requestId: options?.requestId,
    status,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    durationMs,
  };
}
