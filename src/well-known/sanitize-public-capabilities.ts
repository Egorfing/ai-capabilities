import type { AiCapabilitiesManifest, CapabilityExecutionSpec } from "../types/index.js";
import type { WellKnownCapability, WellKnownCapabilityExecution } from "./well-known-types.js";

export function sanitizePublicCapabilities(manifest: AiCapabilitiesManifest): WellKnownCapability[] {
  return manifest.capabilities
    .filter((cap) => cap.policy.visibility === "public")
    .map((cap) => ({
      id: cap.id,
      kind: cap.kind,
      displayTitle: cap.displayTitle,
      description: cap.description,
      userDescription: cap.userDescription,
      aliases: cap.aliases,
      exampleIntents: cap.exampleIntents,
      inputSchema: cap.inputSchema,
      outputSchema: cap.outputSchema,
      policy: { ...cap.policy },
      execution: sanitizeExecution(cap.execution),
    }));
}

function sanitizeExecution(execution?: CapabilityExecutionSpec): WellKnownCapabilityExecution | undefined {
  if (!execution) return undefined;
  const result: WellKnownCapabilityExecution = {
    mode: execution.mode,
  };
  if (execution.endpoint) {
    result.endpoint = {
      method: execution.endpoint.method,
      path: execution.endpoint.path,
      baseUrl: execution.endpoint.baseUrl,
    };
  }
  return result;
}
