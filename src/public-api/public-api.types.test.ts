import { describe, it, expectTypeOf } from "vitest";
import {
  CapabilityRegistry,
  defineCapability,
  defineCapabilityFromExtracted,
  registerCapabilityDefinitions,
} from "ai-capabilities";
import type {
  AiCapabilitiesManifest,
  CapabilityExecutionRequest,
  CapabilityExecutionResult,
  CapabilityHelperContext,
  CapabilityRegistryLike,
  CapabilityRuntimeExecuteOptions,
  CapabilityRuntimeInterface,
  CapabilityRuntimeOptions,
  ExtractedCapabilityDefinitionInput,
} from "ai-capabilities";

describe("public API type exports", () => {
  it("exposes helper context and registry types", () => {
    const capability = defineCapability({
      id: "example.type",
      displayTitle: "Type",
      description: "Type inference helper",
      inputSchema: {
        type: "object",
        properties: {
          value: { type: "string" },
        },
        required: ["value"],
      },
      async execute({ value }: { value: string }) {
        return { echoed: value };
      },
    });

    const registryLike: CapabilityRegistryLike = {
      register: (id, handler) => {
        expectTypeOf(id).toEqualTypeOf<string>();
        expectTypeOf(handler).toBeFunction();
      },
    };

    registerCapabilityDefinitions(registryLike, [capability]);

    expectTypeOf<CapabilityHelperContext>().toMatchTypeOf<{
      router?: { navigate: (path: string, options?: Record<string, unknown>) => unknown };
    }>();

    const extractedInput: ExtractedCapabilityDefinitionInput = {
      sourceId: "hook.example",
      id: "example.type.extracted",
      displayTitle: "Example",
      description: "Example extracted helper",
      inputSchema: { type: "object" },
      policy: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      async execute() {},
    };
    expectTypeOf(extractedInput.sourceId).toEqualTypeOf<string>();
    defineCapabilityFromExtracted(extractedInput);
  });

  it("exposes runtime option/request/result types", () => {
    expectTypeOf<CapabilityRuntimeOptions>().toMatchTypeOf<{
      manifest: AiCapabilitiesManifest;
      registry: CapabilityRegistry;
    }>();

    expectTypeOf<CapabilityRuntimeExecuteOptions>().toMatchTypeOf<{
      handlerContext?: CapabilityHelperContext | undefined;
    }>();

    expectTypeOf<CapabilityRuntimeInterface>().toMatchTypeOf<{
      execute: (
        request: CapabilityExecutionRequest,
        options?: CapabilityRuntimeExecuteOptions,
      ) => Promise<CapabilityExecutionResult>;
    }>();
  });
});
