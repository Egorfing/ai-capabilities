import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CapabilityRegistry,
  CapabilityRuntime,
  defineCapabilityFromExtracted,
  registerCapabilityDefinitions,
} from "ai-capabilities";
import type { AiCapabilitiesManifest } from "ai-capabilities";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const distEntry = path.join(repoRoot, "dist", "index.js");

function ensureDistBuilt(): void {
  if (!existsSync(distEntry)) {
    execSync("npm run build", { stdio: "inherit" });
  }
}

beforeAll(() => {
  ensureDistBuilt();
});

describe("public package runtime exports", () => {
  it("executes a capability imported from ai-capabilities", async () => {
    const echoCapability = defineCapabilityFromExtracted({
      sourceId: "hook.example.echo",
      id: "example.echo",
      displayTitle: "Echo",
      description: "Echo helper for tests",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
      policy: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      async execute({ text }: { text: string }) {
        return { echoed: text };
      },
    });

    const registry = new CapabilityRegistry();
    registerCapabilityDefinitions(registry, [echoCapability]);

    const manifest: AiCapabilitiesManifest = {
      manifestVersion: "test",
      generatedAt: new Date().toISOString(),
      app: { name: "Public API Test" },
      defaults: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      capabilities: [
        {
          id: echoCapability.id,
          kind: "mutation",
          displayTitle: echoCapability.displayTitle,
          description: echoCapability.description,
          userDescription: echoCapability.description,
          inputSchema: echoCapability.inputSchema,
          outputSchema: echoCapability.outputSchema,
          policy: {
            visibility: "internal",
            riskLevel: "low",
            confirmationPolicy: "none",
          },
          tags: echoCapability.tags,
          sources: [{ type: "manual" }],
        },
      ],
    };

    const runtime = new CapabilityRuntime({ manifest, registry, mode: "internal" });

    const result = await runtime.execute({
      capabilityId: echoCapability.id,
      input: { text: "hello" },
      confirmed: true,
    });

    expect(result.status).toBe("success");
    expect(result.data).toEqual({ echoed: "hello" });
    expect(echoCapability.metadata?.extractedSourceId).toBe("hook.example.echo");
  });
});
