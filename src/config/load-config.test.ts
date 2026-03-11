import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadConfig } from "./load-config.js";

const fixtureDir = resolve(import.meta.dirname, "../../fixtures/config/basic");
const fixtureConfigPath = resolve(fixtureDir, "ai-capabilities.config.json");

describe("loadConfig", () => {
  it("loads JSON config and resolves absolute paths", async () => {
    const config = await loadConfig({ configPath: fixtureConfigPath });
    expect(normalize(config.project.root)).toContain("/fixtures/demo-app");
    expect(normalize(config.extractors.openapi.spec[0]!)).toContain(
      "/fixtures/demo-app/openapi.json",
    );
    expect(normalize(config.output.raw)).toContain("/fixtures/config/basic/output/raw.json");
    expect(normalize(config.output.canonical)).toContain("/fixtures/config/basic/output/canonical.json");
    expect(normalize(config.output.public)).toContain("/fixtures/config/basic/output/public.json");
    expect(config.paths.include).toContain("src/**/*");
    expect(config.extractors.router.include).toContain("src/router/**");
    expect(config.extractors.form.include).toContain("src/forms/**");
    expect(config.schema.maxDepth).toBe(4);
    expect(config.schema.resolveRefs).toBe(true);
    expect(config.policy.overrides["api.orders.list-orders"]).toBeDefined();
    expect(config.manifest.app.name).toBe("Fixture App");
    expect(config.manifest.defaults.riskLevel).toBe("medium");
  });

  it("auto-discovers config when no path provided", async () => {
    const config = await loadConfig({ cwd: fixtureDir });
    expect(config.filePath).toBe(fixtureConfigPath);
  });

  it("throws when config missing", async () => {
    await expect(loadConfig({ cwd: resolve(fixtureDir, "missing") })).rejects.toThrow(
      /Cannot find config file/,
    );
  });
});

function normalize(path: string): string {
  return path.replace(/\\/g, "/");
}
