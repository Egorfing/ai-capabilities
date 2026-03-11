import type { AiCapabilitiesManifest, AiCapability } from "../../types/index.js";
import type { ModelToolDefinition } from "../../types/model.js";

export interface BuildToolOptions {
  /** Optional prefix for generated tool names to avoid collisions. */
  namePrefix?: string;
}

export function buildModelToolDefinitions(
  manifest: AiCapabilitiesManifest,
  options: BuildToolOptions = {},
): ModelToolDefinition[] {
  return manifest.capabilities.map((capability) => {
    const name = sanitizeToolName(
      `${options.namePrefix ?? ""}${capability.id}`.trim() || capability.id,
    );
    return {
      name,
      description: buildDescription(capability),
      parameters: capability.inputSchema ?? { type: "object" },
      capabilityId: capability.id,
    };
  });
}

export function sanitizeToolName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 64) : "capability";
}

function buildDescription(capability: AiCapability): string {
  const parts: string[] = [];
  if (capability.displayTitle && capability.displayTitle !== capability.id) {
    parts.push(capability.displayTitle);
  } else {
    parts.push(capability.id);
  }
  if (capability.userDescription) {
    parts.push(capability.userDescription);
  } else if (capability.description) {
    parts.push(capability.description);
  }
  if (capability.policy?.riskLevel) {
    parts.push(`Risk: ${capability.policy.riskLevel}`);
  }
  return parts.join(" — ") || capability.id;
}
