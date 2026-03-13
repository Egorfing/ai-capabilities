import type { AiCapabilitiesManifest } from "../types/index.js";
import type { ResolvedConfig } from "../config/types.js";

export type DoctorStatus =
  | "not_initialized"
  | "initialized"
  | "extracted"
  | "discoverable"
  | "partially_executable"
  | "pilot_ready";

export interface DoctorIssue {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface DoctorFileCheck {
  ok: boolean;
  path: string;
  exists?: boolean;
  message?: string;
}

export interface DoctorCapabilityStats {
  total: number;
  byKind: Record<string, number>;
  byVisibility: Record<string, number>;
  publicCount: number;
  executable: number;
  unbound: number;
  unboundIds: string[];
  confirmationRequired: number;
  highRisk: number;
}

export interface DoctorScaffoldInfo {
  present: boolean;
  directory: string;
  registryExists: boolean;
  capabilitiesDirExists: boolean;
  exampleCapabilityExists: boolean;
}

export interface DoctorReport {
  status: DoctorStatus;
  projectPath?: string;
  configPath?: string;
  configOk: boolean;
  configError?: string;
  outputChecks: {
    raw?: DoctorFileCheck;
    canonical?: DoctorFileCheck;
    public?: DoctorFileCheck;
    enriched?: DoctorFileCheck;
    diagnostics?: DoctorFileCheck;
    tracesDir?: DoctorFileCheck;
  };
  capabilityStats?: DoctorCapabilityStats;
  scaffold?: DoctorScaffoldInfo;
  safetyWarnings: string[];
  issues: DoctorIssue[];
  nextSteps: string[];
}

export interface DoctorRunOptions {
  cwd?: string;
  projectPath?: string;
  configPath?: string;
}

export interface LoadedContext {
  config?: ResolvedConfig;
  manifest?: AiCapabilitiesManifest;
}
