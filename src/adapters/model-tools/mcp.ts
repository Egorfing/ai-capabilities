import type { JsonSchema, AiCapabilitiesManifest } from "../../types/index.js";
import type { ModelToolDefinition } from "../../types/model.js";
import { buildModelToolDefinitions } from "./base.js";

/**
 * MCP (Model Context Protocol) tool definition.
 * Compatible with the MCP tool schema used by Claude Desktop, Cursor, and other MCP hosts.
 * @see https://modelcontextprotocol.io
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Back-reference to the originating capability id. */
  capabilityId: string;
}

/**
 * Convert an ai-capabilities manifest into MCP-compatible tool definitions.
 *
 * Usage with an MCP server framework:
 * ```ts
 * const tools = buildMcpTools(manifest);
 * for (const tool of tools) {
 *   server.addTool(tool.name, tool.inputSchema, async (input) => {
 *     return runtime.execute({ capabilityId: tool.capabilityId, input });
 *   });
 * }
 * ```
 */
export function buildMcpTools(manifest: AiCapabilitiesManifest): McpTool[] {
  const base = buildModelToolDefinitions(manifest);
  return base.map((tool) => toMcpTool(tool));
}

function toMcpTool(tool: ModelToolDefinition): McpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: normalizeSchema(tool.parameters),
    capabilityId: tool.capabilityId,
  };
}

function normalizeSchema(schema: JsonSchema): JsonSchema {
  if (schema && typeof schema === "object") {
    return schema;
  }
  return { type: "object" };
}
