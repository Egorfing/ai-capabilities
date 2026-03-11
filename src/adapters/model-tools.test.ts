import { describe, it, expect } from "vitest";
import {
  buildModelToolDefinitions,
  buildOpenAITools,
  buildAnthropicTools,
  buildInternalTools,
  buildMockTools,
} from "./model-tools/index.js";
import type { AiCapabilitiesManifest } from "../types/index.js";
import { readGoldenJson } from "../test-helpers/fixtures.js";
import { normalizeForSnapshot } from "../test-helpers/snapshots.js";

const manifest: AiCapabilitiesManifest = {
  manifestVersion: "1.0.0",
  generatedAt: "2026-03-10T00:00:00.000Z",
  app: { name: "Demo" },
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
      userDescription: "Creates a new order for a customer.",
      aliases: ["create order"],
      exampleIntents: ["Create order 42"],
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
      tags: ["orders"],
      sources: [{ type: "openapi" }],
      metadata: {},
    },
  ],
};

describe("model tool adapters", () => {
  it("builds universal definitions", () => {
    const tools = buildModelToolDefinitions(manifest);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: "orders_create",
      capabilityId: "orders.create",
      description: expect.stringContaining("Create order"),
    });
  });

  it("produces OpenAI tool format", () => {
    const tools = buildOpenAITools(manifest);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      type: "function",
      capabilityId: "orders.create",
    });
    expect(tools[0].function.parameters).toHaveProperty("properties.orderId.type", "string");
  });

  it("produces Anthropic tool format", () => {
    const tools = buildAnthropicTools(manifest);
    expect(tools[0]).toMatchObject({
      name: "orders_create",
      capabilityId: "orders.create",
    });
    expect(tools[0].input_schema).toHaveProperty("required[0]", "orderId");
  });

  it("produces internal tool format", () => {
    const tools = buildInternalTools(manifest);
    expect(tools[0]).toMatchObject({
      id: "orders_create",
      capabilityId: "orders.create",
      summary: expect.stringContaining("Risk"),
    });
  });

  it("produces mock tool format with prefix", () => {
    const tools = buildMockTools(manifest);
    expect(tools[0].name).toBe("mock_orders_create");
  });
});

describe("adapter contract snapshots", () => {
  const demoManifest = readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.json");

  it("OpenAI adapter matches golden snapshot", () => {
    const actual = normalizeForSnapshot(buildOpenAITools(demoManifest));
    const expected = normalizeForSnapshot(readGoldenJson("demo-app", "adapters.openai.json"));
    expect(actual).toEqual(expected);
  });

  it("Anthropic adapter matches golden snapshot", () => {
    const actual = normalizeForSnapshot(buildAnthropicTools(demoManifest));
    const expected = normalizeForSnapshot(readGoldenJson("demo-app", "adapters.anthropic.json"));
    expect(actual).toEqual(expected);
  });

  it("Internal adapter matches golden snapshot", () => {
    const actual = normalizeForSnapshot(buildInternalTools(demoManifest));
    const expected = normalizeForSnapshot(readGoldenJson("demo-app", "adapters.internal.json"));
    expect(actual).toEqual(expected);
  });

  it("Mock adapter matches golden snapshot", () => {
    const actual = normalizeForSnapshot(buildMockTools(demoManifest));
    const expected = normalizeForSnapshot(readGoldenJson("demo-app", "adapters.mock.json"));
    expect(actual).toEqual(expected);
  });

  it("Universal adapter matches golden snapshot", () => {
    const actual = normalizeForSnapshot(buildModelToolDefinitions(demoManifest));
    const expected = normalizeForSnapshot(readGoldenJson("demo-app", "adapters.universal.json"));
    expect(actual).toEqual(expected);
  });
});
