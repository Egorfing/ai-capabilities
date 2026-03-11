import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { reactQueryExtractor } from "./react-query.js";
import type { ExtractionContext } from "./types.js";
import { createTestConfig } from "../test-helpers/config.js";

const fixtureDir = resolve(import.meta.dirname, "../../fixtures/demo-app");
const ctx: ExtractionContext = {
  projectPath: fixtureDir,
  config: createTestConfig(fixtureDir),
};

describe("reactQueryExtractor", () => {
  it("has correct name and sourceType", () => {
    expect(reactQueryExtractor.name).toBe("react-query");
    expect(reactQueryExtractor.sourceType).toBe("react-query");
  });

  it("extracts hooks from demo fixture", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    expect(result.extractor).toBe("react-query");
    // 3 files: useOrders (4 hooks), useProducts (2 hooks), useProfile (2 hooks) = 8
    expect(result.capabilities.length).toBe(8);
  });

  it("generates kebab-case IDs from hook names", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const ids = result.capabilities.map((c) => c.id);

    expect(ids).toContain("hook.orders");
    expect(ids).toContain("hook.order");
    expect(ids).toContain("hook.create-order");
    expect(ids).toContain("hook.cancel-order");
    expect(ids).toContain("hook.products");
    expect(ids).toContain("hook.product-details");
    expect(ids).toContain("hook.current-user");
    expect(ids).toContain("hook.update-profile");
  });

  it("marks queries as read and mutations as mutation", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const byId = Object.fromEntries(result.capabilities.map((c) => [c.id, c]));

    expect(byId["hook.orders"].kind).toBe("read");
    expect(byId["hook.create-order"].kind).toBe("mutation");
    expect(byId["hook.cancel-order"].kind).toBe("mutation");
    expect(byId["hook.current-user"].kind).toBe("read");
    expect(byId["hook.update-profile"].kind).toBe("mutation");
  });

  it("extracts query keys from queries", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const orders = result.capabilities.find((c) => c.id === "hook.orders")!;

    expect(orders.metadata.queryKey).toContain("orders");
  });

  it("extracts API URLs from queryFn/mutationFn", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const orders = result.capabilities.find((c) => c.id === "hook.orders")!;

    expect(orders.metadata.apiUrl).toBe("/api/orders");
  });

  it("stores hook name in metadata", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const create = result.capabilities.find((c) => c.id === "hook.create-order")!;

    expect(create.metadata.hookName).toBe("useCreateOrder");
    expect(create.metadata.reactQueryCall).toBe("useMutation");
  });

  it("stores source info correctly", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const cap = result.capabilities.find((c) => c.id === "hook.orders")!;

    expect(cap.source.type).toBe("react-query");
    expect(cap.source.filePath).toContain("useOrders.ts");
    expect(cap.source.location).toBe("useOrders");
  });

  it("returns info diagnostic with summary", async () => {
    const result = await reactQueryExtractor.extract(ctx);
    const info = result.diagnostics.find(
      (d) => d.level === "info" && d.message.includes("found"),
    );
    expect(info).toBeDefined();
    expect(info!.message).toContain("8");
     expect(info!.stage).toBe("extraction");
     expect(info!.sourceType).toBe("react-query");
  });

  it("returns empty result for project without TS files", async () => {
    const result = await reactQueryExtractor.extract({
      projectPath: "/tmp/nonexistent",
      config: createTestConfig("/tmp/nonexistent"),
    });
    expect(result.capabilities).toEqual([]);
  });
});
