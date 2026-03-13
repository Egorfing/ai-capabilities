import { defineCapability } from "./define-capability.js";
import type {
  CapabilityDefinitionInput,
  DefinedCapability,
} from "./capability-definition-types.js";

export interface ExtractedCapabilityDefinitionInput<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output = unknown,
> extends CapabilityDefinitionInput<Input, Output> {
  /** Identifier of the extracted capability (e.g. hook.create-project-mutation). */
  sourceId: string;
}

/**
 * Helper for lifting an extracted capability into an authored definition while keeping the source link.
 */
export function defineCapabilityFromExtracted<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output = unknown,
>(
  definition: ExtractedCapabilityDefinitionInput<Input, Output>,
): DefinedCapability<Input, Output> {
  const { sourceId, metadata, ...rest } = definition;
  return defineCapability({
    ...rest,
    metadata: {
      ...metadata,
      extractedSourceId: sourceId,
    },
  });
}
