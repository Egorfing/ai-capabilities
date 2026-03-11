import type { SourceType } from "./capability.js";

export type DiagnosticLevel = "info" | "warning" | "error";

export type DiagnosticStage = "extraction" | "enrichment" | "runtime";

export interface DiagnosticEntry {
  level: DiagnosticLevel;
  stage: DiagnosticStage;
  message: string;
  sourceType?: SourceType;
  filePath?: string;
  capabilityId?: string;
  details?: unknown;
}
