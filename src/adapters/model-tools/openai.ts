import type { JsonSchema } from "../../types/index.js";
import type { ModelToolDefinition } from "../../types/model.js";
import type { AiCapabilitiesManifest } from "../../types/index.js";
import { buildModelToolDefinitions } from "./base.js";

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
  capabilityId: string;
}

export function buildOpenAITools(manifest: AiCapabilitiesManifest): OpenAITool[] {
  const base = buildModelToolDefinitions(manifest);
  return base.map((tool) => toOpenAITool(tool));
}

function toOpenAITool(tool: ModelToolDefinition): OpenAITool {
  return {
    type: "function",
    capabilityId: tool.capabilityId,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: sanitizeSchema(tool.parameters),
    },
  };
}

function sanitizeSchema(schema: JsonSchema): JsonSchema {
  if (schema && typeof schema === "object") {
    return schema;
  }
  return { type: "object" };
}
