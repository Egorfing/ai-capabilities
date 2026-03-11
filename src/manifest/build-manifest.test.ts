import { describe, it, expect } from "vitest";
import { buildAiCapabilitiesManifest } from "./build-manifest.js";
import { createTestConfig } from "../test-helpers/config.js";
import type { RawCapability } from "../types/index.js";

function makeCapability(partial: Partial<RawCapability>): RawCapability {
  if (!partial.id) throw new Error("id required for test capability");
  return {
    id: partial.id,
    kind: partial.kind ?? "mutation",
    source: partial.source ?? { type: "openapi" },
    inputSchema: partial.inputSchema ?? { type: "object", properties: {} },
    metadata: partial.metadata ?? {},
    ...partial,
  } as RawCapability;
}

describe("buildAiCapabilitiesManifest", () => {
  it("creates canonical and public manifests with overrides", () => {
    const config = createTestConfig("/tmp/project");
    config.manifest.app.name = "Test Application";
    config.policy.overrides["cap.public"] = {
      visibility: "public",
      riskLevel: "medium",
      confirmationPolicy: "once",
      tags: ["override"],
      permissionScope: ["orders:write"],
    };
    config.policy.overrides["cap.internal"] = {
      permissionScope: ["internal:read"],
    };

    const capabilities: RawCapability[] = [
      makeCapability({
        id: "cap.public",
        title: "Create Order",
        description: "Creates an order",
        tags: ["orders"],
        effects: ["network-request"],
        metadata: {
          aliases: ["create order"],
          exampleIntents: ["Create order for ACME"],
          execution: {
            mode: "http",
            handlerRef: "orders.create",
            endpoint: { method: "POST", path: "/api/orders" },
          },
          navigation: {
            route: "/orders/:orderId",
            openAfterSuccess: true,
          },
        },
      }),
      makeCapability({
        id: "cap.internal",
        kind: "read",
        metadata: {},
      }),
    ];

    const { canonical, publicManifest } = buildAiCapabilitiesManifest({
      capabilities,
      config,
      generatedAt: "2026-03-10T00:00:00.000Z",
      manifestVersion: "1.0.0",
    });

    expect(canonical.capabilities).toHaveLength(2);
    const publicCap = canonical.capabilities.find((cap) => cap.id === "cap.public")!;
    expect(publicCap.policy.visibility).toBe("public");
    expect(publicCap.policy.permissionScope).toEqual(["orders:write"]);
    expect(publicCap.tags).toEqual(["orders", "override"]);
    expect(publicCap.execution?.handlerRef).toBe("orders.create");

    const internalCap = canonical.capabilities.find((cap) => cap.id === "cap.internal")!;
    expect(internalCap.policy.visibility).toBe("internal");
    expect(internalCap.policy.permissionScope).toEqual(["internal:read"]);

    expect(publicManifest.capabilities).toHaveLength(1);
    const sanitized = publicManifest.capabilities[0]!;
    expect(sanitized.id).toBe("cap.public");
    expect(sanitized.execution?.handlerRef).toBeUndefined();
    expect(sanitized.sources[0]).toEqual({ type: "openapi" });
    expect(sanitized.metadata).toBeUndefined();
  });
});
