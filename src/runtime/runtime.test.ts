import { describe, it, expect, vi } from "vitest";
import { CapabilityRuntime } from "./capability-runtime.js";
import { CapabilityRegistry } from "./capability-registry.js";
import type {
  AiCapabilitiesManifest,
  AiCapability,
  CapabilityExecutionRequest,
} from "../types/index.js";

// ---------------------------------------------------------------------------
// Shared test manifest
// ---------------------------------------------------------------------------

const manifest: AiCapabilitiesManifest = {
  manifestVersion: "1.0.0",
  generatedAt: "2026-03-10T00:00:00.000Z",
  app: { name: "Runtime Demo" },
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
      userDescription: "Creates a new order",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "string" },
        },
        required: ["orderId"],
      },
      policy: {
        visibility: "internal",
        riskLevel: "medium",
        confirmationPolicy: "once",
      },
      tags: [],
      sources: [{ type: "openapi" }],
      metadata: {},
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function registryWith(
  capId: string,
  handler: (input: Record<string, unknown>, context?: Record<string, unknown>) => unknown,
) {
  const registry = new CapabilityRegistry();
  registry.register(capId, handler);
  return registry;
}

function createRequest(
  input: Record<string, unknown>,
  overrides: Partial<CapabilityExecutionRequest> = {},
): CapabilityExecutionRequest {
  return {
    capabilityId: "orders.create",
    input,
    ...overrides,
  };
}

/**
 * Build a manifest with a single capability (+ optional overrides).
 */
function manifestWith(capOverrides: Partial<AiCapability> = {}): AiCapabilitiesManifest {
  return {
    ...manifest,
    capabilities: [
      {
        ...manifest.capabilities[0],
        ...capOverrides,
        policy: {
          ...manifest.capabilities[0].policy,
          ...(capOverrides.policy ?? {}),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Original tests (updated for new policy semantics)
// ---------------------------------------------------------------------------

describe("CapabilityRuntime", () => {
  it("executes handler successfully when confirmed", async () => {
    const registry = registryWith("orders.create", async (input) => ({ received: input.orderId }));
    const runtime = new CapabilityRuntime({ manifest, registry });

    // orders.create has confirmationPolicy: "once" → must confirm
    const request = createRequest({ orderId: "123" }, { confirmed: true });
    const result = await runtime.execute(request);
    expect(result.status).toBe("success");
    expect(result.data).toEqual({ received: "123" });
  });

  it("returns handler not found error", async () => {
    const registry = new CapabilityRegistry();
    const runtime = new CapabilityRuntime({ manifest, registry });

    const result = await runtime.execute(createRequest({ orderId: "123" }));
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("HANDLER_NOT_FOUND");
  });

  it("validates input schema", async () => {
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest, registry });

    const result = await runtime.execute(createRequest({}));
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("INVALID_INPUT");
  });

  it("denies execution when policy visibility mismatches runtime mode", async () => {
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest, registry });

    const result = await runtime.execute(
      createRequest({ orderId: "123" }, { confirmed: true }),
      { mode: "public" },
    );
    expect(result.status).toBe("denied");
    expect(result.error?.code).toBe("POLICY_DENIED");
  });

  it("passes handlerContext through to capability handler", async () => {
    const spy = vi.fn();
    const registry = registryWith("orders.create", async (input, context) => {
      spy(context);
      return { received: input.orderId, mode: context?.mode };
    });
    const runtime = new CapabilityRuntime({ manifest, registry });

    const result = await runtime.execute(
      createRequest({ orderId: "abc" }, { confirmed: true }),
      {
        handlerContext: { mode: "frontend", router: { navigate: (_path: string) => {} } },
      },
    );

    expect(result.status).toBe("success");
    expect(spy).toHaveBeenCalledWith({
      mode: "frontend",
      router: { navigate: expect.any(Function) },
    });
  });
});

// ---------------------------------------------------------------------------
// New tests: policy layer integration
// ---------------------------------------------------------------------------

describe("CapabilityRuntime — policy integration", () => {
  it("returns pending when confirmation is required and not confirmed", async () => {
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest, registry });

    // orders.create has confirmationPolicy: "once", request not confirmed
    const result = await runtime.execute(createRequest({ orderId: "123" }));
    expect(result.status).toBe("pending");
    expect(result.error?.code).toBe("POLICY_CONFIRMATION_REQUIRED");
    expect(result.error?.message).toContain("confirmation");
  });

  it("executes after user confirms", async () => {
    const registry = registryWith("orders.create", async (input) => ({ ok: input.orderId }));
    const runtime = new CapabilityRuntime({ manifest, registry });

    const result = await runtime.execute(
      createRequest({ orderId: "42" }, { confirmed: true }),
    );
    expect(result.status).toBe("success");
    expect(result.data).toEqual({ ok: "42" });
  });

  it("denies high-risk capability without allowDestructive", async () => {
    const m = manifestWith({ policy: { visibility: "public", riskLevel: "high", confirmationPolicy: "none" } });
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest: m, registry });

    const result = await runtime.execute(createRequest({ orderId: "1" }));
    expect(result.status).toBe("denied");
    expect(result.error?.code).toBe("POLICY_DENIED");
    expect(result.error?.message).toContain("allowDestructive");
  });

  it("allows high-risk capability with allowDestructive", async () => {
    const m = manifestWith({ policy: { visibility: "public", riskLevel: "high", confirmationPolicy: "none" } });
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest: m, registry });

    const result = await runtime.execute(
      createRequest({ orderId: "1" }),
      { allowDestructive: true },
    );
    expect(result.status).toBe("success");
  });

  it("denies when required permission scopes are missing", async () => {
    const m = manifestWith({
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none", permissionScope: ["orders:write"] },
    });
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest: m, registry });

    const result = await runtime.execute(createRequest({ orderId: "1" }));
    expect(result.status).toBe("denied");
    expect(result.error?.code).toBe("POLICY_DENIED");
    expect(result.error?.message).toContain("orders:write");
  });

  it("allows when all permission scopes are provided", async () => {
    const m = manifestWith({
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none", permissionScope: ["orders:write"] },
    });
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest: m, registry });

    const result = await runtime.execute(
      createRequest({ orderId: "1" }),
      { permissionScopes: ["orders:write", "extra"] },
    );
    expect(result.status).toBe("success");
  });

  it("includes structured reasons in policy denied details", async () => {
    const registry = registryWith("orders.create", async () => "ok");
    const runtime = new CapabilityRuntime({ manifest, registry });

    const result = await runtime.execute(
      createRequest({ orderId: "1" }, { confirmed: true }),
      { mode: "public" },
    );
    expect(result.status).toBe("denied");
    const details = result.error?.details as { reasons: Array<{ code: string }> };
    expect(details.reasons).toBeDefined();
    expect(details.reasons.some((r) => r.code === "VISIBILITY_DENIED")).toBe(true);
  });

  it("uses manifest defaults when capability policy is partial", async () => {
    const m: AiCapabilitiesManifest = {
      ...manifest,
      defaults: {
        visibility: "public",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      capabilities: [
        {
          ...manifest.capabilities[0],
          policy: {} as AiCapability["policy"],
        },
      ],
    };
    const registry = registryWith("orders.create", async () => "done");
    const runtime = new CapabilityRuntime({ manifest: m, registry });

    // defaults: public, low, none → should pass in internal mode
    const result = await runtime.execute(createRequest({ orderId: "1" }));
    expect(result.status).toBe("success");
  });
});
