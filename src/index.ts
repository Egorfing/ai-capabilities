// Capability Engine — main entry point
export const VERSION = "0.2.1";

export {
  defineCapability,
  registerCapabilityDefinitions,
  capabilityDefinitionToRegistryEntry,
} from "./capability-definition/index.js";
export type {
  CapabilityDefinitionInput,
  DefinedCapability,
  CapabilityHelperContext,
  CapabilityRouterAdapter,
  CapabilityUIAdapter,
  CapabilityNotifyAdapter,
  CapabilityExecutor,
  CapabilityPolicyDefinition,
} from "./capability-definition/index.js";
export {
  CapabilityRegistry,
  CapabilityRuntime,
  evaluatePolicy,
  resolvePolicy,
  visibilityRule,
  permissionScopeRule,
  destructiveRule,
  confirmationRule,
  defaultPolicyRules,
} from "./runtime/index.js";
export type {
  CapabilityHandler,
  CapabilityHandlerContext,
  CapabilityRuntimeExecuteOptions,
  ExecutionMode,
  RuntimeError,
  RuntimeErrorCode,
  PolicyDecision,
  PolicyReason,
  PolicyReasonCode,
  PolicyRule,
  CapabilityExecutionContext,
  ResolvedPolicy,
  EvaluatePolicyOptions,
} from "./runtime/index.js";
export type {
  AiCapabilitiesManifest,
  AiCapability,
  CapabilityExecutionResult,
  CapabilityExecutionRequest,
} from "./types/index.js";
