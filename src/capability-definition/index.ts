export { defineCapability } from "./define-capability.js";
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
export type { CapabilityRegistryLike } from "./capability-definition-to-registry.js";
