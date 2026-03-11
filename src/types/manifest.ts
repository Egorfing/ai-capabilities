// ---------------------------------------------------------------------------
// Domain model: Capability Manifest
// ---------------------------------------------------------------------------

import type {
  RawCapability,
  EnrichedCapability,
  CapabilityKind,
  CapabilitySource,
  JsonSchema,
  RiskLevel,
  ConfirmationPolicy,
  Visibility,
} from "./capability.js";
import type { DiagnosticEntry } from "./diagnostic.js";

/** Metadata about the extraction / enrichment run. */
export interface ManifestMeta {
  generatedAt: string;
  sourceProject?: string;
  extractors?: string[];
  version: string;
}

/** Raw manifest — output of extraction pipeline. */
export interface RawCapabilityManifest {
  meta: ManifestMeta;
  capabilities: RawCapability[];
}

/** Enriched manifest — output of enrichment pipeline. */
export interface EnrichedCapabilityManifest {
  meta: ManifestMeta;
  capabilities: EnrichedCapability[];
}

/** Union alias for convenience. */
export type CapabilityManifest =
  | RawCapabilityManifest
  | EnrichedCapabilityManifest;

// ---------------------------------------------------------------------------
// Canonical ai-capabilities manifest
// ---------------------------------------------------------------------------

export interface ManifestAppInfo {
  name: string;
  version?: string;
  description?: string;
  baseUrl?: string;
}

export interface ManifestDefaults {
  visibility: Visibility;
  riskLevel: RiskLevel;
  confirmationPolicy: ConfirmationPolicy;
}

export interface CapabilityExecutionEndpoint {
  method: string;
  path: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface CapabilityExecutionSpec {
  mode: "http" | "frontend-bridge" | "server-action" | "custom";
  handlerRef?: string;
  endpoint?: CapabilityExecutionEndpoint;
  timeoutMs?: number;
}

export interface CapabilityPolicy {
  visibility: Visibility;
  riskLevel: RiskLevel;
  confirmationPolicy: ConfirmationPolicy;
  permissionScope?: string[];
}

export interface CapabilityEffectDescriptor {
  type: string;
  target?: string;
  description?: string;
}

export interface CapabilityNavigationDescriptor {
  route?: string;
  openAfterSuccess?: boolean;
}

export interface AiCapability {
  id: string;
  kind: CapabilityKind;
  displayTitle: string;
  description: string;
  userDescription?: string;
  aliases?: string[];
  exampleIntents?: string[];
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  execution?: CapabilityExecutionSpec;
  policy: CapabilityPolicy;
  effects?: CapabilityEffectDescriptor[];
  navigation?: CapabilityNavigationDescriptor;
  tags?: string[];
  sources: CapabilitySource[];
  diagnostics?: DiagnosticEntry[];
  metadata?: Record<string, unknown>;
}

export interface AiCapabilitiesManifest {
  manifestVersion: string;
  generatedAt: string;
  app: ManifestAppInfo;
  defaults: ManifestDefaults;
  capabilities: AiCapability[];
}
