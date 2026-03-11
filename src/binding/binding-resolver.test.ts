import { describe, it, expect } from "vitest";
import type { AiCapabilitiesManifest } from "../types/index.js";
import { BindingRegistry } from "./binding-registry.js";
import { BindingResolver } from "./binding-resolver.js";
import { createBoundRegistry } from "./create-bound-registry.js";

const manifest: AiCapabilitiesManifest = {
  manifestVersion: "1.0.0",
  generatedAt: "2026-03-10T00:00:00.000Z",
  app: { name: "Binding Demo" },
  defaults: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  capabilities: [
    {
      id: "orders.create",
      kind: "mutation",
      displayTitle: "Create order",
      description: "Create an order",
      inputSchema: { type: "object" },
      policy: {
        visibility: "internal",
        riskLevel: "medium",
        confirmationPolicy: "once",
      },
      execution: {
        mode: "http",
        endpoint: { method: "POST", path: "/api/orders" },
      },
      tags: [],
      sources: [{ type: "openapi" }],
      metadata: {},
    },
    {
      id: "orders.navigate",
      kind: "navigation",
      displayTitle: "Open order",
      description: "Navigate to order",
      inputSchema: { type: "object" },
      policy: {
        visibility: "public",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      execution: {
        mode: "frontend-bridge",
        handlerRef: "orders.show",
      },
      tags: [],
      sources: [{ type: "router" }],
      metadata: {},
    },
    {
      id: "orders.legacy",
      kind: "mutation",
      displayTitle: "Legacy",
      description: "",
      inputSchema: { type: "object" },
      policy: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      tags: [],
      sources: [{ type: "manual" }],
      metadata: {},
    },
    {
      id: "orders.unsupported",
      kind: "mutation",
      displayTitle: "Unsupported",
      description: "",
      inputSchema: { type: "object" },
      policy: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      execution: {
        mode: "server-action",
      },
      tags: [],
      sources: [{ type: "manual" }],
      metadata: {},
    },
  ],
};

describe("BindingResolver", () => {
  it("prefers explicit manual binding over manifest execution", () => {
    const bindingRegistry = new BindingRegistry();
    bindingRegistry.register({
      capabilityId: "orders.create",
      mode: "manual",
      handler: async () => "manual",
    });

    const resolver = new BindingResolver(manifest, bindingRegistry);
    const result = resolver.resolve("orders.create");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.binding.mode).toBe("manual");
      expect(result.binding.source).toBe("explicit");
    }
  });

  it("falls back to manifest http execution when no explicit binding", () => {
    const resolver = new BindingResolver(manifest, new BindingRegistry());
    const result = resolver.resolve("orders.create");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.binding.mode).toBe("http");
      expect(result.binding.source).toBe("manifest");
      expect(result.binding).toHaveProperty("endpoint.method", "POST");
    }
  });

  it("resolves frontend bridge binding from manifest", () => {
    const resolver = new BindingResolver(manifest, new BindingRegistry());
    const result = resolver.resolve("orders.navigate");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.binding.mode).toBe("frontend-bridge");
      expect(result.binding).toHaveProperty("bridgeAction", "orders.show");
    }
  });

  it("returns binding not found error when capability lacks execution", () => {
    const resolver = new BindingResolver(manifest, new BindingRegistry());
    const result = resolver.resolve("orders.legacy");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BINDING_NOT_FOUND");
    }
  });

  it("returns unsupported mode error", () => {
    const resolver = new BindingResolver(manifest, new BindingRegistry());
    const result = resolver.resolve("orders.unsupported");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_BINDING_MODE");
    }
  });
});

describe("createBoundRegistry", () => {
  it("registers manual bindings into capability registry", () => {
    const bindingRegistry = new BindingRegistry();
    bindingRegistry.register({
      capabilityId: "orders.create",
      mode: "manual",
      handler: async () => "manual",
    });

    const { registry } = createBoundRegistry({ manifest, bindingRegistry });
    expect(registry.hasHandler("orders.create")).toBe(true);
  });
});
