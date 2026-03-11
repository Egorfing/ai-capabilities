import type {
  AiCapabilitiesManifest,
  AiCapability,
  CapabilityKind,
  DiagnosticEntry,
  Visibility,
} from "../types/index.js";
import type { DiagnosticSummary } from "../utils/diagnostics.js";
import type { ResolvedConfig } from "../config/types.js";
import type { BindingMode } from "../binding/index.js";

export interface InspectCommandOptions {
  projectPath?: string;
  configPath?: string;
  cwd?: string;
}

export interface InspectFilters {
  publicOnly?: boolean;
  kind?: CapabilityKind;
  unboundOnly?: boolean;
}

export interface InspectLoadResult {
  projectPath: string;
  config: ResolvedConfig;
  manifest: AiCapabilitiesManifest;
  publicManifest: AiCapabilitiesManifest;
  diagnostics: DiagnosticEntry[];
  extractorsRun: string[];
}

export interface InspectCapabilityInfo {
  capability: AiCapability;
  executable: boolean;
  bindingMode?: BindingMode;
  bindingSource?: "manifest" | "explicit";
  bindingErrorCode?: string;
  requiresConfirmation: boolean;
  isHighRisk: boolean;
}

export interface InspectSummaryMetrics {
  totalAll: number;
  total: number;
  byKind: Record<CapabilityKind, number>;
  byVisibility: Record<Visibility, number>;
  confirmationRequired: number;
  highRisk: number;
  executable: number;
  unbound: number;
  publicCount: number;
}

export interface InspectSummary {
  projectPath: string;
  configPath: string;
  manifestVersion: string;
  appName: string;
  filters: InspectFilters;
  metrics: InspectSummaryMetrics;
  capabilities: InspectCapabilityInfo[];
  warnings: string[];
  diagnosticsSummary: DiagnosticSummary;
  extractorsRun: string[];
}
