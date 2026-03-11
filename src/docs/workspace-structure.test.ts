import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PACKAGES: Array<{ dir: string; name: string }> = [
  { dir: "core", name: "@ai-capabilities/core" },
  { dir: "extract", name: "@ai-capabilities/extract" },
  { dir: "enrich", name: "@ai-capabilities/enrich" },
  { dir: "runtime", name: "@ai-capabilities/runtime" },
  { dir: "adapters", name: "@ai-capabilities/adapters" },
  { dir: "server", name: "@ai-capabilities/server" },
  { dir: "cli", name: "@ai-capabilities/cli" }
];

describe("workspace packaging", () => {
  it("packages directories and package.json exist", () => {
    for (const pkg of PACKAGES) {
      const pkgDir = resolve(ROOT, "packages", pkg.dir);
      expect(existsSync(pkgDir), `missing package dir: ${pkg.dir}`).toBe(true);
      const pkgJsonPath = resolve(pkgDir, "package.json");
      expect(existsSync(pkgJsonPath), `missing package.json for ${pkg.dir}`).toBe(true);
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as { name?: string; main?: string; types?: string };
      expect(pkgJson.name).toBe(pkg.name);
      expect(pkgJson.main, "package main entry required").toBe("./dist/index.js");
      expect(pkgJson.types, "package types entry required").toBe("./dist/index.d.ts");
    }
  });

  it("package entrypoints exist", () => {
    for (const pkg of PACKAGES) {
      const entry = resolve(ROOT, "packages", pkg.dir, "src", "index.ts");
      expect(existsSync(entry), `missing entry point for ${pkg.dir}`).toBe(true);
    }
  });
});
