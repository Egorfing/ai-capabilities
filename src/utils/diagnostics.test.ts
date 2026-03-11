import { describe, it, expect, vi } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatDiagnostic,
  summarizeDiagnostics,
  logDiagnostics,
  writeDiagnosticsFile,
} from "./diagnostics.js";
import type { DiagnosticEntry } from "../types/index.js";

const sampleDiagnostics: DiagnosticEntry[] = [
  {
    level: "warning",
    stage: "extraction",
    sourceType: "openapi",
    message: "Skipped path",
    filePath: "/api.yml",
  },
  {
    level: "error",
    stage: "extraction",
    sourceType: "react-query",
    message: "Failed to parse",
    filePath: "src/hooks/useData.ts",
    details: "stack trace",
  },
];

describe("diagnostics utils", () => {
  it("summarizes diagnostics", () => {
    const summary = summarizeDiagnostics(sampleDiagnostics);
    expect(summary).toEqual({
      total: 2,
      errors: 1,
      warnings: 1,
      infos: 0,
    });
  });

  it("formats diagnostics", () => {
    const formatted = formatDiagnostic(sampleDiagnostics[0]);
    expect(formatted).toContain("[WARNING]");
    expect(formatted).toContain("openapi");
    expect(formatted).toContain("Skipped path");
  });

  it("writes diagnostics to JSONL", () => {
    const dir = mkdtempSync(join(tmpdir(), "diag-test-"));
    const target = join(dir, "diag.jsonl");
    writeDiagnosticsFile(sampleDiagnostics, target);
    const contents = readFileSync(target, "utf-8").trim().split("\n");
    expect(contents).toHaveLength(2);
    expect(JSON.parse(contents[0]!)).toMatchObject({
      level: "warning",
      stage: "extraction",
    });
  });

  it("logs diagnostics honouring minLevel", () => {
    const warnSpy = vi.fn();
    const errorSpy = vi.fn();
    logDiagnostics(sampleDiagnostics, {
      minLevel: "warning",
      loggers: { warning: warnSpy, error: errorSpy },
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
