import type { JsonSchema, AiCapabilitiesManifest } from "../../types/index.js";
import type { ModelToolDefinition } from "../../types/model.js";
import { buildModelToolDefinitions } from "./base.js";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
  capabilityId: string;
}

export function buildAnthropicTools(manifest: AiCapabilitiesManifest): AnthropicTool[] {
  const base = buildModelToolDefinitions(manifest);
  return base.map((tool) => ({
    name: tool.name,
    description: tool.description,
    capabilityId: tool.capabilityId,
    input_schema: normalizeSchema(tool.parameters),
  }));
}

function normalizeSchema(schema: JsonSchema): JsonSchema {
  if (schema && typeof schema === "object") {
    return schema;
  }
  return { type: "object" };
}
