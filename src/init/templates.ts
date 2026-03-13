import type { ConfigTemplateOptions, RegistryTemplateOptions } from "./types.js";

export function createConfigTemplate(options: ConfigTemplateOptions): string {
  const projectName = options.projectName || "App";
  const safeName = projectName.replace(/"/g, '\\"');
  return `{
  "project": {
    "root": "."
  },
  "paths": {
    "include": ["src/**/*"],
    "exclude": [
      ".claude/**",
      "node_modules/**",
      "dist/**",
      "output/**"
    ]
  },
  "output": {
    "raw": "./output/capabilities.raw.json",
    "enriched": "./output/capabilities.enriched.json",
    "canonical": "./output/ai-capabilities.json",
    "public": "./output/ai-capabilities.public.json",
    "diagnostics": "./output/diagnostics.log",
    "tracesDir": "./output/traces"
  },
  "extractors": {
    "openapi": {},
    "reactQuery": {},
    "router": {},
    "form": {}
  },
  "manifest": {
    "app": {
      "name": "${safeName}"
    }
  }
}
`;
}

export function createRegistryTemplate(options: RegistryTemplateOptions): string {
  const { importPath } = options;
  return `// Central place to collect every local capability definition.
// Wire this into your runtime (HTTP server, background worker, etc.).
import { registerCapabilityDefinitions, type CapabilityRegistryLike } from "ai-capabilities";
import { exampleCapability } from "${importPath}";

export const capabilities = [exampleCapability];

export function registerCapabilities(registry: CapabilityRegistryLike): void {
  registerCapabilityDefinitions(registry, capabilities);
}

export type CapabilityList = typeof capabilities;
`;
}

export function createIndexTemplate(): string {
  return `export { registerCapabilities, capabilities } from "./registry";
export { exampleCapability } from "./capabilities/exampleCapability";
`;
}

export function createExampleCapabilityTemplate(): string {
  return `import { defineCapability } from "ai-capabilities";

// Example capability scaffolded by \`npx ai-capabilities init\`.
// Replace or delete once you add real application actions.

type ExampleCapabilityInput = {
  text: string;
};

type ExampleCapabilityResult = {
  echoed: string;
  length: number;
};

export const exampleCapability = defineCapability({
  id: "example.echo",
  displayTitle: "Echo sample text",
  description: "Demonstrates how to register a local action for AI agents.",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Any text to echo back to the caller",
      },
    },
    required: ["text"],
  },
  tags: ["example"],
  policy: {
    visibility: "internal",
    riskLevel: "low",
  },
  async execute({ text }: ExampleCapabilityInput): Promise<ExampleCapabilityResult> {
    return {
      echoed: text,
      length: text.length,
    };
  },
});
`;
}
