// ---------------------------------------------------------------------------
// Domain model: Model-agnostic tool definition
// ---------------------------------------------------------------------------

import type { JsonSchema } from "./capability.js";

/**
 * Internal universal tool format.
 * Adapters convert this into provider-specific shapes
 * (OpenAI function calling, Anthropic tool_use, etc.).
 */
export interface ModelToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
  /** Back-reference to the originating capability. */
  capabilityId: string;
}

/** What the model returns when it selects a tool. */
export interface ModelToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}
