// ---------------------------------------------------------------------------
// Domain model: Capability types
// ---------------------------------------------------------------------------

/** Loose JSON Schema representation — intentionally open for flexibility. */
export type JsonSchema = Record<string, unknown>;

// ---- Enums / Unions -------------------------------------------------------

/** How the capability was discovered. */
export type SourceType =
  | "openapi"
  | "react-query"
  | "router"
  | "form"
  | "manual"
  | "custom";

/** Semantic category of a capability. */
export type CapabilityKind =
  | "read"
  | "mutation"
  | "navigation"
  | "ui-action"
  | "workflow";

/** Side-effects the capability may trigger. */
export type CapabilityEffect =
  | "network-request"
  | "state-mutation"
  | "navigation"
  | "notification"
  | "file-operation"
  | "external-service";

/** How dangerous the capability is to execute without oversight. */
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

/** When user confirmation is required before execution. */
export type ConfirmationPolicy = "none" | "once" | "always";

/** Who should see / be able to invoke this capability. */
export type Visibility = "public" | "internal" | "hidden";

// ---- Supporting structures ------------------------------------------------

/** Where a capability was extracted from. */
export interface CapabilitySource {
  type: SourceType;
  filePath?: string;
  /** E.g. line number, route path, operationId, hook name. */
  location?: string;
}

// ---- RawCapability --------------------------------------------------------

/** Capability as produced by an extractor — no LLM enrichment yet. */
export interface RawCapability {
  id: string;
  source: CapabilitySource;
  /** References to all contributing sources after merge (optional). */
  sources?: CapabilitySource[];
  kind: CapabilityKind;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  effects?: CapabilityEffect[];
  tags?: string[];
  permissions?: string[];
  /** Extractor-specific payload — intentionally open. */
  metadata: Record<string, unknown>;
}

// ---- EnrichedCapability ---------------------------------------------------

/** RawCapability + LLM-generated semantic metadata. */
export interface EnrichedCapability extends RawCapability {
  displayTitle: string;
  userDescription: string;
  aliases: string[];
  exampleIntents: string[];
  confirmationPolicy: ConfirmationPolicy;
  riskLevel: RiskLevel;
  visibility: Visibility;
}
