import { describe, it, expect, vi } from "vitest";
import { defineCapability } from "./define-capability.js";
import { capabilityDefinitionToRegistryEntry, registerCapabilityDefinitions } from "./capability-definition-to-registry.js";
import { CapabilityRegistry } from "../runtime/capability-registry.js";

describe("defineCapability", () => {
  it("freezes definition and fills defaults", () => {
    const cap = defineCapability({
      id: "example.echo",
      displayTitle: "Echo",
      description: "Echo text",
      inputSchema: { type: "object" },
      execute: async (input: { text: string }) => ({ echoed: input.text }),
    });

    expect(cap.id).toBe("example.echo");
    expect(cap.tags).toEqual([]);
    expect(cap.policy).toEqual({});
    expect(cap.source).toBe("manual");
    expect(() => ((cap as unknown as { id: string }).id = "foo")).toThrow();
  });

  it("converts into registry entry", async () => {
    const cap = defineCapability({
      id: "projects.create",
      displayTitle: "Create project",
      description: "Creates a project",
      inputSchema: { type: "object" },
      execute: ({ name }: { name: string }) => ({ id: `proj-${name}` }),
    });

    const entry = capabilityDefinitionToRegistryEntry(cap);
    expect(entry.id).toBe("projects.create");
    const result = entry.handler({ name: "analytics" });
    expect(result).toEqual({ id: "proj-analytics" });
  });

  it("passes execution context to handler", async () => {
    const execute = vi.fn(({ text }: { text: string }, ctx?: { router?: { navigate: (path: string) => void } }) => {
      ctx?.router?.navigate(`/echo/${text}`);
      return { ok: true };
    });
    const cap = defineCapability({
      id: "example.ui",
      kind: "ui-action",
      displayTitle: "UI example",
      description: "Demo UI action",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      execute,
    });

    const entry = capabilityDefinitionToRegistryEntry(cap);
    const navigate = vi.fn();
    await entry.handler({ text: "demo" }, { router: { navigate } });
    expect(execute).toHaveBeenCalledWith({ text: "demo" }, { router: { navigate } });
    expect(navigate).toHaveBeenCalledWith("/echo/demo");
  });

  it("registers definitions with CapabilityRegistry", () => {
    const registry = new CapabilityRegistry();
    const cap = defineCapability({
      id: "example.echo",
      displayTitle: "Echo",
      description: "Echo text",
      inputSchema: { type: "object" },
      execute: ({ text }: { text: string }) => ({ echoed: text }),
    });

    registerCapabilityDefinitions(registry, [cap]);
    const handler = registry.getHandler("example.echo");
    expect(handler).toBeTruthy();
    expect(handler?.({ text: "hi" })).toEqual({ echoed: "hi" });
  });

  it("passes through metadata", () => {
    const cap = defineCapability({
      id: "projects.create",
      displayTitle: "Create project",
      description: "Creates a project",
      inputSchema: { type: "object" },
      metadata: { team: "growth" },
      aliases: ["create project"],
      exampleIntents: ["Create a project"],
      policy: { visibility: "internal" },
      execute: vi.fn(),
    });

    expect(cap.metadata).toEqual({ team: "growth" });
    expect(cap.aliases).toEqual(["create project"]);
    expect(cap.exampleIntents).toEqual(["Create a project"]);
    expect(cap.policy).toEqual({ visibility: "internal" });
  });

  it("warns when destructive capability is marked low risk", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineCapability({
      id: "projects.delete",
      displayTitle: "Delete project",
      description: "Removes a project",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      policy: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
      execute: vi.fn(),
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('capability "projects.delete"'),
    );
    warn.mockRestore();
  });

  it("does not warn when destructive capability is high risk", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineCapability({
      id: "projects.delete",
      displayTitle: "Delete project",
      description: "Removes a project",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      policy: { visibility: "hidden", riskLevel: "high", confirmationPolicy: "always" },
      execute: vi.fn(),
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
