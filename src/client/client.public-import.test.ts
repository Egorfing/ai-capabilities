import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const distEntry = path.join(repoRoot, "dist", "client", "index.js");

function ensureClientBuilt(): void {
  if (!existsSync(distEntry)) {
    execSync("npm run build", { stdio: "inherit" });
  }
}

beforeAll(() => {
  ensureClientBuilt();
});

describe("ai-capabilities/client public entry", () => {
  it("exports discovery and execution helpers", async () => {
    const clientModule = await import("ai-capabilities/client");
    expect(typeof clientModule.getWellKnownManifest).toBe("function");
    expect(typeof clientModule.discoverCapabilities).toBe("function");
    expect(typeof clientModule.executeCapability).toBe("function");
  });
});
