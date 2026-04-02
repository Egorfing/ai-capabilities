import { describe, it, expect } from "vitest";
import { buildMcpTools } from "./mcp.js";
import type { AiCapabilitiesManifest } from "../../types/index.js";

function makeManifest(
  capabilities: AiCapabilitiesManifest["capabilities"],
): AiCapabilitiesManifest {
  return {
    manifestVersion: "1.0",
    generatedAt: new Date().toISOString(),
    app: { name: "test-app", version: "1.0.0" },
    capabilities,
  } as AiCapabilitiesManifest;
}

describe("buildMcpTools", () => {
  it("converts capabilities to MCP tool format", () => {
    const manifest = makeManifest([
      {
        id: "api.orders.list-orders",
        kind: "backend",
        displayTitle: "List Orders",
        description: "List all orders",
        inputSchema: {
          type: "object",
          properties: { status: { type: "string" } },
        },
      } as any,
    ]);

    const tools = buildMcpTools(manifest);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toEqual({
      name: "api_orders_list_orders",
      description: expect.stringContaining("List Orders"),
      inputSchema: {
        type: "object",
        properties: { status: { type: "string" } },
      },
      capabilityId: "api.orders.list-orders",
    });
  });

  it("sanitizes tool names (dots → underscores)", () => {
    const manifest = makeManifest([
      {
        id: "navigation.open-project-page",
        kind: "ui-action",
        description: "Navigate to project",
      } as any,
    ]);

    const tools = buildMcpTools(manifest);
    expect(tools[0].name).toBe("navigation_open_project_page");
    expect(tools[0].capabilityId).toBe("navigation.open-project-page");
  });

  it("defaults inputSchema to { type: 'object' } when missing", () => {
    const manifest = makeManifest([
      {
        id: "system.health-check",
        kind: "backend",
        description: "Health check",
      } as any,
    ]);

    const tools = buildMcpTools(manifest);
    expect(tools[0].inputSchema).toEqual({ type: "object" });
  });

  it("handles multiple capabilities", () => {
    const manifest = makeManifest([
      { id: "a.one", kind: "backend", description: "First" } as any,
      { id: "b.two", kind: "backend", description: "Second" } as any,
      { id: "c.three", kind: "ui-action", description: "Third" } as any,
    ]);

    const tools = buildMcpTools(manifest);
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.capabilityId)).toEqual([
      "a.one",
      "b.two",
      "c.three",
    ]);
  });

  it("includes risk level in description when present", () => {
    const manifest = makeManifest([
      {
        id: "orders.delete",
        kind: "backend",
        description: "Delete an order",
        policy: { riskLevel: "high" },
      } as any,
    ]);

    const tools = buildMcpTools(manifest);
    expect(tools[0].description).toContain("Risk: high");
  });
});
