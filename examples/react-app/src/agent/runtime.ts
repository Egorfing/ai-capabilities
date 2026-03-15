import {
  CapabilityRegistry,
  CapabilityRuntime,
} from "ai-capabilities";
import type {
  AiCapabilitiesManifest,
  CapabilityExecutionResult,
} from "ai-capabilities";
import { exampleCapabilities, registerExampleCapabilities } from "../app-capabilities/index.js";

export interface RouterAdapter {
  navigate: (path: string) => void;
}

export interface UIAdapter {
  openPanel?: (id: string, payload?: Record<string, unknown>) => void;
}

export interface NotifyAdapter {
  info?: (message: string) => void;
  warn?: (message: string) => void;
}

export interface RuntimeAdapters {
  router: RouterAdapter;
  ui: UIAdapter;
  notify: NotifyAdapter;
}

export function createExampleRuntime(adapters: RuntimeAdapters) {
  const registry = new CapabilityRegistry();
  registerExampleCapabilities(registry);

  const manifest = buildManifest();
  const runtime = new CapabilityRuntime({ manifest, registry, mode: "internal" });

  return {
    async invoke(capabilityId: string, input: Record<string, unknown>): Promise<CapabilityExecutionResult> {
      return runtime.execute(
        {
          capabilityId,
          input,
          confirmed: true,
        },
        {
          handlerContext: adapters,
        },
      );
    },
    manifest,
  };
}

function buildManifest(): AiCapabilitiesManifest {
  return {
    manifestVersion: "example",
    generatedAt: new Date().toISOString(),
    app: { name: "Example React App" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities: exampleCapabilities.map((cap) => ({
      id: cap.id,
      kind: cap.kind ?? "mutation",
      displayTitle: cap.displayTitle,
      description: cap.description,
      userDescription: cap.description,
      aliases: cap.aliases,
      exampleIntents: cap.exampleIntents,
      inputSchema: cap.inputSchema,
      outputSchema: cap.outputSchema,
      policy: {
        visibility: cap.policy?.visibility ?? "internal",
        riskLevel: cap.policy?.riskLevel ?? "low",
        confirmationPolicy: cap.policy?.confirmationPolicy ?? "none",
      },
      tags: cap.tags,
      sources: [{ type: "manual" }],
    })),
  };
}
