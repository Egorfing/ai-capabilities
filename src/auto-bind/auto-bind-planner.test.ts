import { describe, it, expect, vi } from "vitest";
import { classifyCapability, analyzeAutoBindCandidates } from "./auto-bind-planner.js";
import type { AiCapability, AiCapabilitiesManifest } from "../types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCapability(overrides: Partial<AiCapability> = {}): AiCapability {
  return {
    id: "items.list",
    kind: "read",
    displayTitle: "List items",
    description: "Lists all items",
    inputSchema: { type: "object" },
    policy: {
      visibility: "public",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    tags: [],
    sources: [{ type: "openapi" }],
    metadata: {},
    ...overrides,
    policy: {
      visibility: "public",
      riskLevel: "low",
      confirmationPolicy: "none",
      ...(overrides.policy ?? {}),
    },
  } as AiCapability;
}

function makeManifest(capabilities: AiCapability[]): AiCapabilitiesManifest {
  return {
    manifestVersion: "1.0.0",
    generatedAt: "2026-03-10T00:00:00.000Z",
    app: { name: "Test" },
    defaults: {
      visibility: "public",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("classifyCapability", () => {
  it("classifies a GET / read endpoint with low risk as auto", () => {
    const cap = makeCapability({
      id: "orders.list",
      kind: "read",
      displayTitle: "List orders",
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
    });
    const decision = classifyCapability(cap);
    expect(decision.status).toBe("auto");
  });

  it("classifies a DELETE endpoint with destructive pattern as dangerous", () => {
    const cap = makeCapability({
      id: "orders.delete",
      kind: "mutation",
      displayTitle: "Delete order",
      policy: { visibility: "public", riskLevel: "medium", confirmationPolicy: "none" },
    });
    const decision = classifyCapability(cap);
    expect(decision.status).toBe("dangerous");
    if (decision.status === "dangerous") {
      expect(decision.reason).toBeDefined();
    }
  });

  it("classifies a POST create endpoint without destructive pattern as auto", () => {
    const cap = makeCapability({
      id: "orders.create",
      kind: "mutation",
      displayTitle: "Create order",
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
    });
    const decision = classifyCapability(cap);
    expect(decision.status).toBe("auto");
  });

  it("classifies a capability with riskLevel high as dangerous", () => {
    const cap = makeCapability({
      id: "admin.settings",
      kind: "mutation",
      displayTitle: "Update settings",
      policy: { visibility: "public", riskLevel: "high", confirmationPolicy: "none" },
    });
    const decision = classifyCapability(cap);
    expect(decision.status).toBe("dangerous");
  });

  it("classifies a capability with destructive effect as dangerous", () => {
    const cap = makeCapability({
      id: "data.cleanup",
      kind: "mutation",
      displayTitle: "Cleanup data",
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
      effects: [{ type: "destructive", description: "Removes stale records" }],
    });
    const decision = classifyCapability(cap);
    expect(decision.status).toBe("dangerous");
  });

  it("classifies a mutation without create/update pattern as uncertain", () => {
    const cap = makeCapability({
      id: "orders.process",
      kind: "mutation",
      displayTitle: "Process order",
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
    });
    const decision = classifyCapability(cap);
    expect(decision.status).toBe("uncertain");
  });
});

describe("analyzeAutoBindCandidates", () => {
  it("groups capabilities into auto, dangerous, and uncertain buckets", () => {
    const capabilities = [
      makeCapability({ id: "items.list", kind: "read" }),
      makeCapability({ id: "items.delete", kind: "mutation", displayTitle: "Delete item" }),
      makeCapability({ id: "items.process", kind: "mutation", displayTitle: "Process item" }),
    ];
    const plan = analyzeAutoBindCandidates(makeManifest(capabilities));
    expect(plan.auto.length).toBe(1);
    expect(plan.auto[0].capability.id).toBe("items.list");
    expect(plan.dangerous.length).toBe(1);
    expect(plan.dangerous[0].capability.id).toBe("items.delete");
    expect(plan.uncertain.length).toBe(1);
    expect(plan.uncertain[0].capability.id).toBe("items.process");
  });
});
