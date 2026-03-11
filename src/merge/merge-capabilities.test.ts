import { describe, it, expect } from "vitest";
import type { RawCapability } from "../types/index.js";
import { mergeCapabilities } from "./merge-capabilities.js";

const baseCap = (overrides: Partial<RawCapability>): RawCapability => ({
  id: overrides.id ?? "cap",
  source: overrides.source ?? { type: "openapi" },
  kind: overrides.kind ?? "mutation",
  title: overrides.title ?? "Title",
  description: overrides.description ?? "Desc",
  inputSchema: overrides.inputSchema ?? { type: "object", properties: {} },
  metadata: overrides.metadata ?? {},
  tags: overrides.tags,
  effects: overrides.effects,
});

describe("mergeCapabilities", () => {
  it("keeps single capability unchanged", () => {
    const cap = baseCap({});
    const { capabilities } = mergeCapabilities([cap]);
    expect(capabilities).toHaveLength(1);
    expect(capabilities[0].id).toBe("cap");
    expect(capabilities[0].sources?.length).toBeUndefined();
  });

  it("merges openapi and react-query by identity", () => {
    const openapi = baseCap({
      id: "api.orders.create-order",
      source: { type: "openapi", filePath: "openapi.json" },
      metadata: { operationId: "createOrder" },
    });
    const hook = baseCap({
      id: "hook.create-order",
      source: { type: "react-query", filePath: "useOrders.ts", location: "useCreateOrder" },
      metadata: { hookName: "useCreateOrder" },
      inputSchema: { type: "object", properties: { foo: { type: "string" } } },
    });
    const forms = baseCap({
      id: "form.create-order",
      source: { type: "form", filePath: "forms.ts" },
      metadata: {},
      tags: ["form"],
      inputSchema: {
        type: "object",
        properties: { customerId: { type: "string" }, items: { type: "string" } },
      },
    });

    const { capabilities } = mergeCapabilities([openapi, hook, forms]);
    expect(capabilities).toHaveLength(1);
    const merged = capabilities[0];
    expect(merged.source.type).toBe("openapi");
    expect(merged.sources).toHaveLength(3);
    expect(Object.keys(merged.inputSchema.properties as Record<string, unknown>)).toContain(
      "customerId",
    );
    expect(merged.tags).toContain("form");
  });

  it("handles non-overlapping identities separately", () => {
    const a = baseCap({
      id: "api.a",
      source: { type: "openapi" },
      metadata: { operationId: "a" },
    });
    const b = baseCap({
      id: "hook.b",
      source: { type: "react-query" },
      metadata: { hookName: "useB" },
    });
    const { capabilities } = mergeCapabilities([a, b]);
    expect(capabilities).toHaveLength(2);
  });
});
