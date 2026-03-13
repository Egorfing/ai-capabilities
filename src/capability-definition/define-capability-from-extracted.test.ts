import { describe, it, expect } from "vitest";
import { CapabilityRegistry } from "../runtime/capability-registry.js";
import { defineCapabilityFromExtracted } from "./define-capability-from-extracted.js";
import { registerCapabilityDefinitions } from "./capability-definition-to-registry.js";

describe("defineCapabilityFromExtracted", () => {
  it("preserves metadata linkage to the extracted source", () => {
    const capability = defineCapabilityFromExtracted({
      sourceId: "hook.create-project-mutation",
      id: "projects.create",
      displayTitle: "Create project",
      description: "Creates a new project",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      policy: {
        visibility: "internal",
        riskLevel: "medium",
        confirmationPolicy: "once",
      },
      async execute({ name }: { name: string }) {
        return { created: name };
      },
    });

    expect(capability.metadata?.extractedSourceId).toBe("hook.create-project-mutation");
  });

  it("registers and executes like a normal capability", async () => {
    const capability = defineCapabilityFromExtracted({
      sourceId: "hook.projects-query",
      id: "projects.list",
      displayTitle: "List projects",
      description: "Lists projects",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      policy: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      async execute() {
        return { items: ["proj_1"] };
      },
    });

    const registry = new CapabilityRegistry();
    registerCapabilityDefinitions(registry, [capability]);
    const handler = registry.getHandler("projects.list");
    const result = await handler?.({});

    expect(result).toEqual({ items: ["proj_1"] });
  });
});
