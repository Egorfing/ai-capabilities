import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(import.meta.dirname, "../../dist/cli/index.js");

beforeAll(() => {
  const tsc = resolve(import.meta.dirname, "../../node_modules/.bin/tsc");
  execFileSync(tsc, [], { stdio: "inherit" });
});

const run = (...args: string[]) => {
  try {
    const out = execFileSync("node", [cli, ...args], {
      encoding: "utf-8",
      timeout: 10_000,
      env: { ...process.env },
    });
    return { code: 0, output: out };
  } catch (err) {
    const e = err as { status: number; stderr: string; stdout: string };
    return { code: e.status, output: (e.stderr ?? "") + (e.stdout ?? "") };
  }
};

describe("CLI integration", () => {
  it("shows help when no command given", () => {
    const r = run();
    expect(r.code).toBe(1);
    expect(r.output).toContain("capability-engine");
    expect(r.output).toContain("Commands:");
  });

  it("shows help with 'help' command", () => {
    const r = run("help");
    expect(r.code).toBe(0);
    expect(r.output).toContain("Commands:");
  });

  it("rejects unknown command", () => {
    const r = run("foobar");
    expect(r.code).toBe(1);
    expect(r.output).toContain('Unknown command: "foobar"');
  });

  it("extract --help shows usage", () => {
    const r = run("extract", "--help");
    expect(r.code).toBe(0);
    expect(r.output).toContain("--project");
  });

  it("validate works on raw manifest", () => {
    const file = resolve(import.meta.dirname, "../../docs/contract/capabilities.raw.json");
    const r = run("validate", "--file", file);
    expect(r.code).toBe(0);
    expect(r.output).toContain("Valid raw manifest");
  });

  it("validate works on enriched manifest", () => {
    const file = resolve(import.meta.dirname, "../../docs/contract/capabilities.enriched.json");
    const r = run("validate", "--file", file, "--enriched");
    expect(r.code).toBe(0);
    expect(r.output).toContain("Valid enriched manifest");
  });

  it("validate fails on enriched check with raw file", () => {
    const file = resolve(import.meta.dirname, "../../docs/contract/capabilities.raw.json");
    const r = run("validate", "--file", file, "--enriched");
    expect(r.code).toBe(1);
    expect(r.output).toContain("Invalid manifest");
  });

  it("validate requires --file", () => {
    const r = run("validate");
    expect(r.code).toBe(1);
    expect(r.output).toContain("--file");
  });
});
