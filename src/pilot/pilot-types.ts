import type { DiagnosticSummary } from "../utils/diagnostics.js";

export type PilotStatus = "success" | "partial" | "failed";

export interface PilotOptions {
  projectPath?: string;
  configPath?: string;
  reportDir?: string;
  withEnrich?: boolean;
  model?: string;
  cwd?: string;
}

export interface PilotArtifacts {
  rawManifest?: string;
  canonicalManifest?: string;
  publicManifest?: string;
  enrichedManifest?: string;
  diagnosticsLog?: string;
  tracesDir?: string;
  pilotReport?: string;
  pilotSummary?: string;
}

export interface PilotExtractorReport {
  name: string;
  status: PilotStatus;
  capabilities: number;
  warnings: number;
  errors: number;
}

export interface PilotSummaryMetrics {
  capabilitiesTotal: number;
  publicCapabilities: number;
  diagnostics: {
    info: number;
    warning: number;
    error: number;
  };
}

export interface PilotCompatibility {
  errors: string[];
  warnings: string[];
}

export interface PilotReport {
  startedAt: string;
  finishedAt: string;
  projectPath: string;
  configPath: string;
  traceId?: string;
  status: PilotStatus;
  summary: PilotSummaryMetrics;
  compatibility: PilotCompatibility;
  extractors: PilotExtractorReport[];
  artifacts: PilotArtifacts;
  unsupportedPatterns: string[];
  diagnosticsSummary: DiagnosticSummary;
  notes?: string[];
}

export interface PilotRunResult {
  report: PilotReport;
  reportPath: string;
  summaryPath: string;
}
