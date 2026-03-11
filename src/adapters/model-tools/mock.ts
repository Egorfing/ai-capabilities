import type { AiCapabilitiesManifest } from "../../types/index.js";
import type { ModelToolDefinition } from "../../types/model.js";
import { buildModelToolDefinitions } from "./base.js";

export function buildMockTools(manifest: AiCapabilitiesManifest): ModelToolDefinition[] {
  return buildModelToolDefinitions(manifest, { namePrefix: "mock_" });
}
