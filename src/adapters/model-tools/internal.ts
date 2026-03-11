import type { JsonSchema, AiCapabilitiesManifest } from "../../types/index.js";
import { buildModelToolDefinitions } from "./base.js";

export interface InternalToolDefinition {
  id: string;
  capabilityId: string;
  summary: string;
  schema: JsonSchema;
  metadata?: Record<string, unknown>;
}

export function buildInternalTools(manifest: AiCapabilitiesManifest): InternalToolDefinition[] {
  const base = buildModelToolDefinitions(manifest);
  return base.map((tool) => ({
    id: tool.name,
    capabilityId: tool.capabilityId,
    summary: tool.description,
    schema: tool.parameters,
  }));
}
