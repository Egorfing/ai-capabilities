import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { routerExtractor } from "./router.js";
import type { ExtractionContext } from "./types.js";
import { createTestConfig } from "../test-helpers/config.js";

const fixtureDir = resolve(import.meta.dirname, "../../fixtures/demo-app");
const ctx: ExtractionContext = {
  projectPath: fixtureDir,
  config: createTestConfig(fixtureDir),
};

describe("routerExtractor", () => {
  it("extracts routes from demo fixture", async () => {
    const result = await routerExtractor.extract(ctx);
    expect(result.capabilities.length).toBe(5);
    const ids = result.capabilities.map((c) => c.id);
    expect(ids).toContain("navigate.to.root");
    expect(ids).toContain("navigate.to.orders");
    expect(ids).toContain("navigate.to.orders.order-id");
    expect(ids).toContain("navigate.to.orders.new");
    expect(ids).toContain("navigate.to.products.product-id.details");
  });

  it("captures params and metadata", async () => {
    const result = await routerExtractor.extract(ctx);
    const route = result.capabilities.find((c) => c.id === "navigate.to.orders.order-id")!;
    expect(route.kind).toBe("navigation");
    expect(route.source.type).toBe("router");
    expect(route.inputSchema.required).toContain("orderId");
    expect(route.metadata.path).toBe("/orders/:orderId");
  });

  it("emits info diagnostics", async () => {
    const result = await routerExtractor.extract(ctx);
    const info = result.diagnostics.find(
      (d) => d.level === "info" && d.message.includes("routes from"),
    );
    expect(info).toBeDefined();
    expect(info!.stage).toBe("extraction");
    expect(info!.sourceType).toBe("router");
  });
});
