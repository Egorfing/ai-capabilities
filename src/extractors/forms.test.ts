import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { formExtractor } from "./forms.js";
import type { ExtractionContext } from "./types.js";
import { createTestConfig } from "../test-helpers/config.js";

const fixtureDir = resolve(import.meta.dirname, "../../fixtures/demo-app");
const config = createTestConfig(fixtureDir);
config.extractors.form.include = ["src/forms/**"];
const ctx: ExtractionContext = {
  projectPath: fixtureDir,
  config,
};

describe("formExtractor", () => {
  it("extracts Zod schemas into form capabilities", async () => {
    const result = await formExtractor.extract(ctx);
    expect(result.capabilities.length).toBeGreaterThan(0);
    const form = result.capabilities.find((c) => c.id === "form.create-order");
    expect(form).toBeDefined();
    expect(form!.inputSchema.type).toBe("object");
    expect((form!.inputSchema.properties as Record<string, any>).customerId.type).toBe("string");
    expect((form!.inputSchema.required as string[])).toContain("customerId");
    expect((form!.inputSchema.properties as Record<string, any>).comment.type).toBe("string");
  });

  it("emits info diagnostics per file", async () => {
    const result = await formExtractor.extract(ctx);
    const info = result.diagnostics.find(
      (d) => d.level === "info" && d.message.includes("schemas from"),
    );
    expect(info).toBeDefined();
    expect(info!.sourceType).toBe("form");
  });
});
