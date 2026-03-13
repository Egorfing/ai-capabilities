import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initProject } from "./index.js";

function setupDir(): string {
  return mkdtempSync(join(tmpdir(), "ai-cap-init-"));
}

describe("initProject", () => {
  it("creates config and scaffold when missing", async () => {
    const dir = setupDir();
    const result = await initProject({ cwd: dir });

    expect(result.config.status).toBe("created");
    expect(result.scaffold.every((r) => r.status === "created")).toBe(true);
    expect(existsSync(join(dir, "ai-capabilities.config.json"))).toBe(true);
    expect(existsSync(join(dir, "src/ai-capabilities/index.ts"))).toBe(true);
    expect(existsSync(join(dir, "src/ai-capabilities/registry.ts"))).toBe(true);
    expect(existsSync(join(dir, "src/ai-capabilities/capabilities/exampleCapability.ts"))).toBe(true);
  });

  it("does not overwrite existing files", async () => {
    const dir = setupDir();
    const configPath = join(dir, "ai-capabilities.config.json");
    writeFileSync(configPath, "{\n  \"project\": {}\n}\n", "utf-8");
    const registryPath = join(dir, "src/ai-capabilities/registry.ts");
    mkdirSync(join(dir, "src/ai-capabilities"), { recursive: true });
    writeFileSync(registryPath, "export const capabilities = [];\n", "utf-8");

    const result = await initProject({ cwd: dir });

    expect(result.config.status).toBe("skipped");
    const registryReport = result.scaffold.find((r) => r.path.endsWith("registry.ts"));
    expect(registryReport?.status).toBe("skipped");
  });

  it("records next steps for CLI summary", async () => {
    const dir = setupDir();
    const result = await initProject({ cwd: dir });
    expect(result.nextSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.nextSteps[0]).toContain("ai-capabilities.config.json");
    expect(result.nextSteps.some((step) => step.includes("inspect"))).toBe(true);
  });

  it("injects detected project name into config", async () => {
    const dir = setupDir();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test-app" }, null, 2));
    await initProject({ cwd: dir });
    const config = readFileSync(join(dir, "ai-capabilities.config.json"), "utf-8");
    expect(config).toContain("test-app");
  });

  it("generates example capability content", async () => {
    const dir = setupDir();
    await initProject({ cwd: dir });
    const example = readFileSync(
      join(dir, "src/ai-capabilities/capabilities/exampleCapability.ts"),
      "utf-8",
    );
    expect(example).toContain("example.echo");
    expect(example).toContain("async execute");
  });
});
