export { CapabilityRegistry } from "./capability-registry.js";
export type { CapabilityOverrides, CapabilityRegistryRegisterOptions } from "./capability-registry.js";
export { CapabilityRuntime } from "./capability-runtime.js";
export type { CapabilityRuntimeOptions } from "./capability-runtime.js";
export type {
  CapabilityHandler,
  CapabilityHandlerContext,
  CapabilityRuntimeExecuteOptions,
  CapabilityRuntimeInterface,
  ExecutionMode,
} from "./runtime-types.js";
export type { RuntimeErrorCode, RuntimeError } from "./runtime-errors.js";

// Re-export policy layer for convenience
export { evaluatePolicy, resolvePolicy } from "../policy/index.js";
export type {
  PolicyDecision,
  PolicyReason,
  PolicyReasonCode,
  PolicyRule,
  CapabilityExecutionContext,
  ResolvedPolicy,
  EvaluatePolicyOptions,
} from "../policy/index.js";
export {
  visibilityRule,
  permissionScopeRule,
  destructiveRule,
  confirmationRule,
  defaultPolicyRules,
} from "../policy/index.js";
