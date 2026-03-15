import type { AiCapabilitiesManifest, CapabilityExecutionSpec, CapabilitySource } from "../types/index.js";

export function buildPublicManifestSnapshot(manifest: AiCapabilitiesManifest): AiCapabilitiesManifest {
  const capabilities = manifest.capabilities
    .filter((cap) => cap.policy.visibility === "public")
    .map((cap) => sanitizeCapability(cap));

  return {
    manifestVersion: manifest.manifestVersion,
    generatedAt: manifest.generatedAt,
    app: { ...manifest.app },
    defaults: { ...manifest.defaults },
    capabilities,
  };
}

function sanitizeCapability(cap: AiCapabilitiesManifest["capabilities"][number]) {
  return {
    ...cap,
    execution: sanitizeExecution(cap.execution),
    sources: cap.sources?.map((source) => sanitizeSource(source)),
    diagnostics: undefined,
    metadata: undefined,
  };
}

function sanitizeExecution(execution?: CapabilityExecutionSpec): CapabilityExecutionSpec | undefined {
  if (!execution) return undefined;
  const sanitized: CapabilityExecutionSpec = { ...execution };
  delete (sanitized as { handlerRef?: string }).handlerRef;
  return sanitized;
}

function sanitizeSource(source: CapabilitySource): CapabilitySource {
  return { type: source.type };
}
