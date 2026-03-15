import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { openApiExtractor } from "./openapi.js";
import type { ExtractionContext } from "./types.js";
import { createTestConfig } from "../test-helpers/config.js";

const fixtureDir = resolve(import.meta.dirname, "../../fixtures/demo-app");
const swaggerFixtureDir = resolve(import.meta.dirname, "../../fixtures/swagger");

const ctx: ExtractionContext = {
  projectPath: fixtureDir,
  config: createTestConfig(fixtureDir),
};

describe("openApiExtractor", () => {
  it("has correct name and sourceType", () => {
    expect(openApiExtractor.name).toBe("openapi");
    expect(openApiExtractor.sourceType).toBe("openapi");
  });

  it("extracts capabilities from demo fixture", async () => {
    const result = await openApiExtractor.extract(ctx);
    expect(result.extractor).toBe("openapi");
    expect(result.capabilities.length).toBe(7); // 7 operations in the fixture
  });

  it("generates correct IDs with operationId and tag", async () => {
    const result = await openApiExtractor.extract(ctx);
    const ids = result.capabilities.map((c) => c.id);

    expect(ids).toContain("api.orders.list-orders");
    expect(ids).toContain("api.orders.create-order");
    expect(ids).toContain("api.orders.get-order");
    expect(ids).toContain("api.orders.cancel-order");
    expect(ids).toContain("api.products.list-products");
    expect(ids).toContain("api.users.get-current-user");
    expect(ids).toContain("api.users.update-profile");
  });

  it("sets kind=read for GET and kind=mutation for POST/PATCH/DELETE", async () => {
    const result = await openApiExtractor.extract(ctx);
    const byId = Object.fromEntries(result.capabilities.map((c) => [c.id, c]));

    expect(byId["api.orders.list-orders"].kind).toBe("read");
    expect(byId["api.orders.create-order"].kind).toBe("mutation");
    expect(byId["api.orders.cancel-order"].kind).toBe("mutation");
    expect(byId["api.users.update-profile"].kind).toBe("mutation");
  });

  it("extracts query parameters into inputSchema", async () => {
    const result = await openApiExtractor.extract(ctx);
    const listOrders = result.capabilities.find((c) => c.id === "api.orders.list-orders")!;
    const props = listOrders.inputSchema.properties as Record<string, unknown>;

    expect(props).toHaveProperty("page");
    expect(props).toHaveProperty("limit");
    expect(props).toHaveProperty("status");
  });

  it("extracts path parameters into inputSchema", async () => {
    const result = await openApiExtractor.extract(ctx);
    const getOrder = result.capabilities.find((c) => c.id === "api.orders.get-order")!;
    const props = getOrder.inputSchema.properties as Record<string, unknown>;

    expect(props).toHaveProperty("orderId");
    expect((getOrder.inputSchema.required as string[]) ?? []).toContain("orderId");
  });

  it("merges requestBody into inputSchema", async () => {
    const result = await openApiExtractor.extract(ctx);
    const create = result.capabilities.find((c) => c.id === "api.orders.create-order")!;
    const props = create.inputSchema.properties as Record<string, unknown>;

    expect(props).toHaveProperty("items");
    expect(props).toHaveProperty("shippingAddressId");
  });

  it("extracts response schema as outputSchema", async () => {
    const result = await openApiExtractor.extract(ctx);
    const listOrders = result.capabilities.find((c) => c.id === "api.orders.list-orders")!;

    expect(listOrders.outputSchema).toBeDefined();
    expect(listOrders.outputSchema!.type).toBe("object");
  });

  it("stores source metadata correctly", async () => {
    const result = await openApiExtractor.extract(ctx);
    const cap = result.capabilities[0];

    expect(cap.source.type).toBe("openapi");
    expect(cap.source.filePath).toContain("openapi.json");
    expect(cap.metadata.method).toBeDefined();
    expect(cap.metadata.path).toBeDefined();
  });

  it("returns info diagnostics about extraction", async () => {
    const result = await openApiExtractor.extract(ctx);
    const infos = result.diagnostics.filter((d) => d.level === "info");
    expect(infos.length).toBeGreaterThan(0);
    expect(infos.every((d) => d.stage === "extraction" && d.sourceType === "openapi")).toBe(true);
  });

  it("returns empty result for project without openapi spec", async () => {
    const result = await openApiExtractor.extract({
      projectPath: "/tmp/nonexistent",
      config: createTestConfig("/tmp/nonexistent"),
    });
    expect(result.capabilities).toEqual([]);
    expect(result.diagnostics.some((d) => d.level === "info" && d.stage === "extraction")).toBe(true);
  });

  it("uses configured spec paths when provided", async () => {
    const config = createTestConfig(fixtureDir);
    config.extractors.openapi.spec = [resolve(fixtureDir, "openapi.json")];
    const result = await openApiExtractor.extract({
      projectPath: "/should/not/matter",
      config,
    });
    expect(result.capabilities.length).toBe(7);
  });

  it("extracts capabilities from Swagger 2.0 specs", async () => {
    const config = createTestConfig(swaggerFixtureDir);
    const specPath = resolve(swaggerFixtureDir, "orders.swagger.json");
    config.extractors.openapi.spec = [specPath];
    const result = await openApiExtractor.extract({
      projectPath: swaggerFixtureDir,
      config,
    });

    expect(result.capabilities.length).toBe(3);
    const listCap = result.capabilities.find((c) => c.id === "api.orders.list-orders")!;
    const createCap = result.capabilities.find((c) => c.id === "api.orders.create-order")!;

    expect(listCap.inputSchema.properties).toHaveProperty("status");
    expect(createCap.inputSchema.properties).toHaveProperty("items");
    expect(createCap.outputSchema).toBeDefined();
    expect(result.diagnostics.some((d) => d.filePath?.includes("orders.swagger.json"))).toBe(true);
  });
});
