export { defineCapability } from "./define-capability.js";
export { defineCapabilityFromExtracted } from "./define-capability-from-extracted.js";
export {
  capabilityDefinitionToRegistryEntry,
  registerCapabilityDefinitions,
} from "./capability-definition-to-registry.js";
export type {
  CapabilityDefinitionInput,
  DefinedCapability,
  CapabilityHelperContext,
  CapabilityRouterAdapter,
  CapabilityUIAdapter,
  CapabilityNotifyAdapter,
  CapabilityExecutor,
  CapabilityPolicyDefinition,
} from "./capability-definition-types.js";
export type { ExtractedCapabilityDefinitionInput } from "./define-capability-from-extracted.js";
export type { CapabilityRegistryLike } from "./capability-definition-to-registry.js";
