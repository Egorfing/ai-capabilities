import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import type { DiagnosticEntry } from "../types/index.js";
import type { PilotReport } from "./pilot-types.js";

export function writePilotReport(report: PilotReport, filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(report, null, 2) + "\n");
}

export function toReportPath(path?: string): string | undefined {
  if (!path) return undefined;
  const rel = relative(process.cwd(), path);
  if (!rel || rel.startsWith("..")) {
    return path;
  }
  return rel.startsWith(".") ? rel : `./${rel}`;
}

export function collectUnsupportedPatterns(diagnostics: DiagnosticEntry[]): string[] {
  const keywords = ["unsupported", "not supported", "missing support"];
  const set = new Set<string>();
  for (const entry of diagnostics) {
    const message = entry.message ?? "";
    const lower = message.toLowerCase();
    if (keywords.some((word) => lower.includes(word))) {
      set.add(message.trim());
    }
  }
  return Array.from(set.values());
}
