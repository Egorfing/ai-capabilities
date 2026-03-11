import type {
  AiCapabilitiesManifest,
  AiCapability,
  ConfirmationPolicy,
  RiskLevel,
} from "../types/index.js";

export interface CapabilityEnrichment {
  displayTitle?: string;
  userDescription?: string;
  aliases?: string[];
  exampleIntents?: string[];
  riskLevel?: RiskLevel;
  confirmationPolicy?: ConfirmationPolicy;
}

export type EnrichedAiCapability = AiCapability & {
  userDescription?: string;
  aliases?: string[];
  exampleIntents?: string[];
};

export interface EnrichedAiCapabilitiesManifest extends AiCapabilitiesManifest {
  capabilities: EnrichedAiCapability[];
}

const RISK_LEVELS: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];
const CONFIRMATION_POLICIES: ConfirmationPolicy[] = ["none", "once", "always"];

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && RISK_LEVELS.includes(value as RiskLevel);
}

export function isConfirmationPolicy(value: unknown): value is ConfirmationPolicy {
  return typeof value === "string" && CONFIRMATION_POLICIES.includes(value as ConfirmationPolicy);
}
