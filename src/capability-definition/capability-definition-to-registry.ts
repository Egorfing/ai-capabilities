import type {
  CapabilityHelperContext,
  DefinedCapability,
} from "./capability-definition-types.js";
import type { CapabilityHandler } from "../runtime/runtime-types.js";

export interface RegistryEntry {
  id: string;
  handler: CapabilityHandler;
}

export interface CapabilityRegistryLike {
  register: (capabilityId: string, handler: CapabilityHandler) => void;
}

export function capabilityDefinitionToRegistryEntry(
  definition: DefinedCapability,
): RegistryEntry {
  return {
    id: definition.id,
    handler: (input, context) =>
      definition.execute(
        input as never,
        (context as CapabilityHelperContext | undefined) ?? undefined,
      ),
  };
}

export function registerCapabilityDefinitions(
  registry: CapabilityRegistryLike,
  definitions: DefinedCapability[],
): void {
  definitions.forEach((definition) => {
    const entry = capabilityDefinitionToRegistryEntry(definition);
    registry.register(entry.id, entry.handler);
  });
}
