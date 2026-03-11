import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DiagnosticEntry, DiagnosticLevel } from "../types/index.js";

const LEVEL_ORDER: Record<DiagnosticLevel, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

export interface LogDiagnosticsOptions {
  /**
   * Minimum level to display. Defaults to "warning" (only warnings/errors).
   */
  minLevel?: DiagnosticLevel;
  loggers?: Partial<Record<DiagnosticLevel, (line: string) => void>>;
}

const DEFAULT_LOGGERS: Record<DiagnosticLevel, (line: string) => void> = {
  info: console.log,
  warning: console.warn,
  error: console.error,
};

export function formatDiagnostic(entry: DiagnosticEntry): string {
  const parts = [
    `[${entry.level.toUpperCase()}]`,
    entry.stage,
    entry.sourceType ?? "n/a",
  ];
  if (entry.filePath) {
    parts.push(entry.filePath);
  }
  if (entry.capabilityId) {
    parts.push(entry.capabilityId);
  }
  return `${parts.join(" | ")} — ${entry.message}`;
}

export function logDiagnostics(
  diagnostics: DiagnosticEntry[],
  options: LogDiagnosticsOptions = {},
): void {
  const minLevel = options.minLevel ?? "warning";
  const minOrder = LEVEL_ORDER[minLevel];
  const loggers = { ...DEFAULT_LOGGERS, ...(options.loggers ?? {}) };

  const sorted = [...diagnostics].sort(
    (a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level],
  );

  for (const entry of sorted) {
    if (LEVEL_ORDER[entry.level] < minOrder) continue;
    (loggers[entry.level] ?? console.error)(formatDiagnostic(entry));
  }
}

export interface DiagnosticSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
}

export function summarizeDiagnostics(diagnostics: DiagnosticEntry[]): DiagnosticSummary {
  return diagnostics.reduce<DiagnosticSummary>(
    (summary, entry) => {
      summary.total += 1;
      if (entry.level === "error") summary.errors += 1;
      else if (entry.level === "warning") summary.warnings += 1;
      else summary.infos += 1;
      return summary;
    },
    { total: 0, errors: 0, warnings: 0, infos: 0 },
  );
}

export function writeDiagnosticsFile(
  diagnostics: DiagnosticEntry[],
  targetPath: string,
): void {
  mkdirSync(dirname(targetPath), { recursive: true });
  const payload =
    diagnostics.map((entry) => JSON.stringify(entry)).join("\n") +
    (diagnostics.length > 0 ? "\n" : "");
  writeFileSync(targetPath, payload);
}
