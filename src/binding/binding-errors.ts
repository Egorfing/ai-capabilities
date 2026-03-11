import type { BindingError, BindingErrorCode } from "./binding-types.js";

function createError(code: BindingErrorCode, message: string, details?: unknown): BindingError {
  return { code, message, details };
}

export function capabilityNotFound(capabilityId: string): BindingError {
  return createError("CAPABILITY_NOT_FOUND", `Capability "${capabilityId}" not found`);
}

export function bindingNotFound(capabilityId: string): BindingError {
  return createError("BINDING_NOT_FOUND", `No binding available for "${capabilityId}"`);
}

export function unsupportedBindingMode(mode: string): BindingError {
  return createError("UNSUPPORTED_BINDING_MODE", `Binding mode "${mode}" is not supported`);
}

export function invalidBinding(details: string): BindingError {
  return createError("INVALID_BINDING", details);
}
