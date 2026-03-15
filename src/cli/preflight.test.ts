import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectInitializationStatus, ensureInitializedForCommand } from "./preflight.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ai-cap-preflight-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

describe("detectInitializationStatus", () => {
  it("flags missing config and scaffold in a fresh directory", () => {
    const cwd = makeTempDir();
    const status = detectInitializationStatus({ cwd });
    expect(status.initialized).toBe(false);
    expect(status.missingRequired.some((item) => item.id === "config")).toBe(true);
    expect(status.missingOptional.length).toBeGreaterThanOrEqual(1);
  });

  it("accepts an explicit config path even if default files are absent", () => {
    const cwd = makeTempDir();
    mkdirSync(join(cwd, "config"), { recursive: true });
    writeFileSync(join(cwd, "config/custom.config.json"), JSON.stringify({ project: { root: "." } }, null, 2));
    const status = detectInitializationStatus({ cwd, explicitConfigPath: "config/custom.config.json" });
    expect(status.initialized).toBe(true);
    expect(status.missingRequired).toHaveLength(0);
  });
});

describe("ensureInitializedForCommand", () => {
  it("auto-runs init when interactive prompt returns yes", async () => {
    const cwd = makeTempDir();
    const prompt = vi.fn().mockResolvedValue(true);
    await ensureInitializedForCommand({
      cwd,
      commandLabel: "extract",
      interactive: true,
      prompt,
    });
    expect(prompt).toHaveBeenCalled();
    expect(existsSync(join(cwd, "ai-capabilities.config.json"))).toBe(true);
    expect(existsSync(join(cwd, "src/app-capabilities/index.ts"))).toBe(true);
  });

  it("skips the prompt when the project is already initialized", async () => {
    const cwd = makeTempDir();
    await ensureInitializedForCommand({
      cwd,
      commandLabel: "extract",
      interactive: true,
      prompt: async () => true,
    });
    const prompt = vi.fn();
    await ensureInitializedForCommand({
      cwd,
      commandLabel: "extract",
      interactive: true,
      prompt,
    });
    expect(prompt).not.toHaveBeenCalled();
  });

  it("throws a descriptive error in non-interactive mode", async () => {
    const cwd = makeTempDir();
    await expect(
      ensureInitializedForCommand({
        cwd,
        commandLabel: "extract",
        interactive: false,
      }),
    ).rejects.toThrow(/npx ai-capabilities init/);
  });
});
