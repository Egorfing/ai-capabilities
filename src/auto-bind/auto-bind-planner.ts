import type { AiCapabilitiesManifest, AiCapability, CapabilityPolicy } from "../types/index.js";

const DESTRUCTIVE_PATTERN = /\b(delete|remove|drop|destroy|wipe|reset|terminate)\b/i;
const CREATE_UPDATE_PATTERN = /(create|add|update|set|sync|upsert)/i;
const SAFE_READ_RISKS = new Set(["safe", "low"]);
const SAFE_MUTATION_RISKS = new Set(["safe", "low", "medium"]);

export interface AutoDecision {
  status: "auto";
  capability: AiCapability;
  sourceId: string;
  targetId: string;
  fileBase: string;
}

export interface SkipDecision {
  status: "dangerous" | "uncertain";
  capability: AiCapability;
  reason: string;
}

export type AutoBindDecision = AutoDecision | SkipDecision;

export interface AutoBindPlan {
  auto: AutoDecision[];
  dangerous: SkipDecision[];
  uncertain: SkipDecision[];
}

export function analyzeAutoBindCandidates(manifest: AiCapabilitiesManifest): AutoBindPlan {
  const decisions = manifest.capabilities.map((capability) => classifyCapability(capability));
  return {
    auto: decisions.filter((entry): entry is AutoDecision => entry.status === "auto"),
    dangerous: decisions.filter((entry): entry is SkipDecision => entry.status === "dangerous"),
    uncertain: decisions.filter((entry): entry is SkipDecision => entry.status === "uncertain"),
  };
}

export function classifyCapability(capability: AiCapability): AutoBindDecision {
  const sourceId = capability.id;
  if (isDestructive(capability)) {
    return { status: "dangerous", capability, reason: "Marked destructive or high-risk" };
  }

  if (isSafeRead(capability)) {
    return {
      status: "auto",
      capability,
      sourceId,
      targetId: deriveAuthoredCapabilityId(capability),
      fileBase: buildCapabilityFileBase(sourceId),
    };
  }

  if (isSafeCreateOrUpdate(capability)) {
    return {
      status: "auto",
      capability,
      sourceId,
      targetId: deriveAuthoredCapabilityId(capability),
      fileBase: buildCapabilityFileBase(sourceId),
    };
  }

  return { status: "uncertain", capability, reason: "Does not meet auto-bind criteria" };
}

export function deriveAuthoredCapabilityId(capability: AiCapability): string {
  const metadata = capability.metadata as Record<string, unknown> | undefined;
  const preferred = metadata && typeof metadata.canonicalId === "string" ? (metadata.canonicalId as string) : undefined;
  if (preferred && preferred.trim()) {
    return preferred.trim();
  }
  const isRead = capability.kind === "read";
  const base = capability.id;
  let withoutPrefix = base.replace(/^hook[./]/i, "");
  withoutPrefix = withoutPrefix.replace(/^(get|use)[./-]/i, "");
  withoutPrefix = withoutPrefix.replace(/-(mutation|query)$/i, "");
  let normalized = withoutPrefix.replace(/[\\/]/g, ".").replace(/[_-]/g, ".");
  normalized = normalized.replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");
  if (!normalized) {
    normalized = base;
  }
  if (isRead && !normalized.includes(".")) {
    normalized = `${normalized}.list`;
  }
  if (capability.kind === "mutation" && !normalized.includes(".")) {
    normalized = `${normalized}.create`;
  }
  return normalized;
}

export function buildCapabilityFileBase(sourceId: string): string {
  const withoutPrefix = sourceId.replace(/^hook[./]/i, "");
  const withoutSuffix = withoutPrefix.replace(/-(mutation|query)$/i, "");
  const camel = toCamelCase(withoutSuffix);
  return `${camel || "capability"}Capability`;
}

function isDestructive(capability: AiCapability): boolean {
  const risk = capability.policy?.riskLevel ?? "medium";
  if (risk === "high" || risk === "critical") {
    return true;
  }
  const effect = capability.effects?.some((entry) => entry.type === "destructive");
  if (effect) return true;
  if (DESTRUCTIVE_PATTERN.test(capability.id) || DESTRUCTIVE_PATTERN.test(capability.displayTitle)) {
    return true;
  }
  return false;
}

function isSafeRead(capability: AiCapability): boolean {
  if (capability.kind !== "read") return false;
  return SAFE_READ_RISKS.has(normalizeRisk(capability.policy));
}

function isSafeCreateOrUpdate(capability: AiCapability): boolean {
  if (capability.kind !== "mutation") return false;
  const risk = normalizeRisk(capability.policy);
  if (!SAFE_MUTATION_RISKS.has(risk)) return false;
  return CREATE_UPDATE_PATTERN.test(capability.id) || CREATE_UPDATE_PATTERN.test(capability.displayTitle);
}

function normalizeRisk(policy: CapabilityPolicy): string {
  return policy.riskLevel?.toLowerCase?.() ?? "unknown";
}

function toCamelCase(value: string): string {
  const parts = value.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  const [first, ...rest] = parts;
  let result =
    first.toLowerCase() + rest.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join("");
  if (!/^[a-zA-Z_]/.test(result)) {
    result = `cap${result.charAt(0).toUpperCase()}${result.slice(1)}`;
  }
  return result;
}
