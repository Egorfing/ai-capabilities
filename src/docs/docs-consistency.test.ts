import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const DOCS = [
  "docs/quickstart.md",
  "docs/demo.md",
  "docs/architecture.md",
  "docs/manifest.md",
  "docs/extraction.md",
  "docs/enrichment.md",
  "docs/adapters.md",
  "docs/runtime.md",
  "docs/policy.md",
  "docs/server.md",
  "docs/external-agents.md",
  "docs/pilot.md",
  "docs/testing.md",
  "docs/contributing.md",
];
const README_PATH = resolve(ROOT, "README.md");
const PACKAGE_JSON = resolve(ROOT, "package.json");

describe("documentation consistency", () => {
  it("all required docs exist", () => {
    DOCS.forEach((relativePath) => {
      expect(existsSync(resolve(ROOT, relativePath)), `${relativePath} missing`).toBe(true);
    });
    expect(existsSync(README_PATH)).toBe(true);
  });

  it("README links to docs and scripts exist", () => {
    const readme = readFileSync(README_PATH, "utf-8");
    DOCS.forEach((relativePath) => {
      expect(readme.includes(relativePath), `README missing link to ${relativePath}`).toBe(true);
    });

    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8")) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    const requiredScripts = ["build", "test", "extract", "enrich", "serve", "pilot"];
    requiredScripts.forEach((name) => {
      expect(scripts[name], `package.json missing script ${name}`).toBeDefined();
    });
    requiredScripts.forEach((name) => {
      const command = `npm run ${name}`;
      expect(readme.includes(command), `README missing command ${command}`).toBe(true);
    });
  });
});
