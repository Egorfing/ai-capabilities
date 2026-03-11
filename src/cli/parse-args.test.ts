import { describe, it, expect } from "vitest";
import { parseArgs } from "./parse-args.js";

// Helper: simulate process.argv = ["node", "script.ts", ...rest]
const argv = (...rest: string[]) => ["node", "cli.ts", ...rest];

describe("parseArgs", () => {
  it("parses a simple command", () => {
    const r = parseArgs(argv("extract"));
    expect(r.command).toBe("extract");
    expect(r.flags).toEqual({});
  });

  it("parses sub-commands (trace list)", () => {
    const r = parseArgs(argv("trace", "list"));
    expect(r.command).toBe("trace list");
  });

  it("parses --key value flags", () => {
    const r = parseArgs(argv("extract", "--project", "./my-app"));
    expect(r.command).toBe("extract");
    expect(r.flags.project).toBe("./my-app");
  });

  it("parses --key=value flags", () => {
    const r = parseArgs(argv("validate", "--file=manifest.json"));
    expect(r.flags.file).toBe("manifest.json");
  });

  it("parses boolean flags", () => {
    const r = parseArgs(argv("validate", "--enriched", "--file", "f.json"));
    expect(r.flags.enriched).toBe(true);
    expect(r.flags.file).toBe("f.json");
  });

  it("parses short flags", () => {
    const r = parseArgs(argv("serve", "-p", "8080"));
    expect(r.flags.p).toBe("8080");
  });

  it("returns empty command when no args", () => {
    const r = parseArgs(argv());
    expect(r.command).toBe("");
  });
});
