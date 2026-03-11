export type RuntimeErrorCode =
  | "CAPABILITY_NOT_FOUND"
  | "HANDLER_NOT_FOUND"
  | "INVALID_INPUT"
  | "POLICY_DENIED"
  | "POLICY_CONFIRMATION_REQUIRED"
  | "HANDLER_ERROR";

export interface RuntimeError {
  code: RuntimeErrorCode;
  message: string;
  details?: unknown;
}

export function capabilityNotFound(capabilityId: string): RuntimeError {
  return {
    code: "CAPABILITY_NOT_FOUND",
    message: `Capability "${capabilityId}" not found in manifest`,
  };
}

export function handlerNotFound(capabilityId: string): RuntimeError {
  return {
    code: "HANDLER_NOT_FOUND",
    message: `Handler not registered for "${capabilityId}"`,
  };
}

export function invalidInput(details: unknown): RuntimeError {
  return {
    code: "INVALID_INPUT",
    message: "Input failed schema validation",
    details,
  };
}

export function policyDenied(reason: string, details?: unknown): RuntimeError {
  return {
    code: "POLICY_DENIED",
    message: reason,
    details,
  };
}

export function policyConfirmationRequired(reason: string, details?: unknown): RuntimeError {
  return {
    code: "POLICY_CONFIRMATION_REQUIRED",
    message: reason,
    details,
  };
}

export function handlerError(error: unknown): RuntimeError {
  return {
    code: "HANDLER_ERROR",
    message: "Handler execution failed",
    details: serializeError(error),
  };
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}
