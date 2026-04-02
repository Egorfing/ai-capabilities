import type { CapabilityExecutionResult } from "../types/index.js";
import { success, failure } from "./response-builders.js";
import type { RouteResult, JsonValue } from "./server-types.js";

export function mapExecutionResult(result: CapabilityExecutionResult): RouteResult {
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
  // In production, hide implementation details for all error types except validation errors
  const isProduction = process.env.NODE_ENV === "production";
  if (code === "HANDLER_ERROR") {
    return undefined;
  }
  if (isProduction && code !== "INVALID_INPUT" && code !== "INVALID_REQUEST") {
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
