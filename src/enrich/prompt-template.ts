import type { AiCapability } from "../types/index.js";

export function buildEnrichmentPrompt(capability: AiCapability): string {
  const payload = {
    id: capability.id,
    kind: capability.kind,
    description: capability.description ?? "",
    inputSchema: capability.inputSchema,
    tags: capability.tags ?? [],
    metadata: capability.metadata ?? {},
  };

  return [
    "You are enriching a capability for an AI agent.",
    "",
    `Capability id: ${capability.id}`,
    `Kind: ${capability.kind}`,
    "",
    "Capability JSON:",
    JSON.stringify(payload, null, 2),
    "",
    "Your task:",
    "Generate semantic metadata to help AI agents understand this capability.",
    "",
    "Return ONLY a JSON object with the following optional fields:",
    "- displayTitle",
    "- userDescription",
    "- aliases (array of strings)",
    "- exampleIntents (array of strings)",
    "- riskLevel (one of safe/low/medium/high/critical)",
    "- confirmationPolicy (one of none/once/always)",
    "",
    "If you are unsure about a field, omit it instead of guessing.",
  ].join("\n");
}
