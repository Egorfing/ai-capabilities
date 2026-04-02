import { describe, it, expect, vi } from "vitest";
import { buildWellKnownResponse, sanitizePublicCapabilities } from "./index.js";
import type { AiCapabilitiesManifest, AiCapability } from "../types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildManifest(): AiCapabilitiesManifest {
  return {
    manifestVersion: "1.0.0",
    generatedAt: "2026-03-10T00:00:00.000Z",
    app: { name: "Test App", version: "1.0.0" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities: [
      {
        id: "orders.list",
        kind: "read",
        displayTitle: "List orders",
        description: "Lists orders",
        userDescription: "View your orders",
        inputSchema: { type: "object" },
        policy: {
          visibility: "public",
          riskLevel: "low",
          confirmationPolicy: "none",
        },
        tags: [],
        sources: [{ type: "openapi" }],
        metadata: { internal: true },
      },
      {
        id: "admin.audit",
        kind: "read",
        displayTitle: "Audit log",
        description: "Internal audit",
        inputSchema: { type: "object" },
        policy: {
          visibility: "internal",
          riskLevel: "high",
          confirmationPolicy: "none",
        },
        tags: [],
        sources: [{ type: "openapi" }],
        metadata: {},
      },
      {
        id: "orders.create",
        kind: "mutation",
        displayTitle: "Create order",
        description: "Creates an order",
        inputSchema: { type: "object", properties: { id: { type: "string" } } },
        policy: {
          visibility: "public",
          riskLevel: "medium",
          confirmationPolicy: "once",
        },
        tags: ["orders"],
        sources: [{ type: "openapi" }],
        metadata: {},
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// sanitizePublicCapabilities
// ---------------------------------------------------------------------------

describe("sanitizePublicCapabilities", () => {
  it("filters out internal capabilities", () => {
    const manifest = buildManifest();
    const result = sanitizePublicCapabilities(manifest);
    const ids = result.map((c) => c.id);
    expect(ids).not.toContain("admin.audit");
  });

  it("includes public capabilities", () => {
    const manifest = buildManifest();
    const result = sanitizePublicCapabilities(manifest);
    const ids = result.map((c) => c.id);
    expect(ids).toContain("orders.list");
    expect(ids).toContain("orders.create");
  });

  it("strips sources and metadata from output", () => {
    const manifest = buildManifest();
    const result = sanitizePublicCapabilities(manifest);
    for (const cap of result) {
      expect(cap).not.toHaveProperty("sources");
      expect(cap).not.toHaveProperty("metadata");
      expect(cap).not.toHaveProperty("tags");
    }
  });

  it("preserves policy, inputSchema and displayTitle", () => {
    const manifest = buildManifest();
    const result = sanitizePublicCapabilities(manifest);
    const ordersList = result.find((c) => c.id === "orders.list")!;
    expect(ordersList.displayTitle).toBe("List orders");
    expect(ordersList.inputSchema).toEqual({ type: "object" });
    expect(ordersList.policy.riskLevel).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// buildWellKnownResponse
// ---------------------------------------------------------------------------

describe("buildWellKnownResponse", () => {
  it("returns expected top-level shape", () => {
    const manifest = buildManifest();
    const response = buildWellKnownResponse({
      manifest,
      mode: "public",
      executionEndpoint: { method: "POST", path: "/execute" },
      capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    });

    expect(response.manifestVersion).toBe("1.0.0");
    expect(response.app.name).toBe("Test App");
    expect(response.discovery.mode).toBe("public");
    expect(response.discovery.executionEndpoint).toEqual({ method: "POST", path: "/execute" });
    expect(response.discovery.capabilitiesEndpoint).toEqual({ method: "GET", path: "/capabilities" });
    expect(response.interaction).toBeDefined();
    expect(response.policy).toBeDefined();
  });

  it("only includes public capabilities in the response", () => {
    const manifest = buildManifest();
    const response = buildWellKnownResponse({
      manifest,
      mode: "public",
      executionEndpoint: { method: "POST", path: "/execute" },
      capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    });

    const ids = response.capabilities.map((c) => c.id);
    expect(ids).toContain("orders.list");
    expect(ids).toContain("orders.create");
    expect(ids).not.toContain("admin.audit");
  });

  it("populates default interaction hints", () => {
    const manifest = buildManifest();
    const response = buildWellKnownResponse({
      manifest,
      mode: "public",
      executionEndpoint: { method: "POST", path: "/execute" },
      capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    });

    expect(response.interaction.toolCalling).toBe(true);
    expect(response.interaction.httpExecution).toBe(true);
    expect(response.interaction.streaming).toBe(false);
  });

  it("includes policy defaults from manifest", () => {
    const manifest = buildManifest();
    const response = buildWellKnownResponse({
      manifest,
      mode: "internal",
      executionEndpoint: { method: "POST", path: "/execute" },
      capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    });

    expect(response.policy.defaultVisibility).toBe("internal");
    expect(response.policy.defaultRiskLevel).toBe("low");
    expect(response.policy.defaultConfirmationPolicy).toBe("none");
    expect(response.policy.confirmationSupported).toBe(false);
  });

  it("assigns execution endpoint fallback to capabilities without one", () => {
    const manifest = buildManifest();
    const response = buildWellKnownResponse({
      manifest,
      mode: "public",
      executionEndpoint: { method: "POST", path: "/execute" },
      capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    });

    for (const cap of response.capabilities) {
      expect(cap.execution?.endpoint).toEqual({ method: "POST", path: "/execute" });
    }
  });
});
