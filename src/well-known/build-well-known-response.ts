import type { AiCapabilitiesManifest } from "../types/index.js";
import type { ExecutionMode } from "../runtime/runtime-types.js";
import type {
  EndpointReference,
  InteractionHints,
  WellKnownResponse,
  WellKnownCapability,
} from "./well-known-types.js";
import { sanitizePublicCapabilities } from "./sanitize-public-capabilities.js";

export interface BuildWellKnownResponseOptions {
  manifest: AiCapabilitiesManifest;
  mode: ExecutionMode;
  executionEndpoint: EndpointReference;
  capabilitiesEndpoint: EndpointReference;
  interactionHints?: InteractionHints;
}

export function buildWellKnownResponse(options: BuildWellKnownResponseOptions): WellKnownResponse {
  const capabilities = applyExecutionFallback(
    sanitizePublicCapabilities(options.manifest),
    options.executionEndpoint,
  );

  return {
    manifestVersion: options.manifest.manifestVersion,
    generatedAt: options.manifest.generatedAt,
    app: options.manifest.app,
    discovery: {
      mode: options.mode,
      executionEndpoint: options.executionEndpoint,
      capabilitiesEndpoint: options.capabilitiesEndpoint,
    },
    policy: {
      defaultVisibility: options.manifest.defaults.visibility,
      defaultRiskLevel: options.manifest.defaults.riskLevel,
      defaultConfirmationPolicy: options.manifest.defaults.confirmationPolicy,
      confirmationSupported: options.manifest.defaults.confirmationPolicy !== "none",
    },
    interaction: normalizeInteractionHints(options.interactionHints),
    capabilities,
  };
}

function applyExecutionFallback(
  capabilities: WellKnownCapability[],
  executionEndpoint: EndpointReference,
): WellKnownCapability[] {
  return capabilities.map((cap) => {
    if (cap.execution?.endpoint) {
      return cap;
    }
    const mode = cap.execution?.mode ?? inferMode(executionEndpoint);
    return {
      ...cap,
      execution: {
        mode,
        endpoint: executionEndpoint,
      },
    };
  });
}

function inferMode(endpoint: EndpointReference): string {
  return endpoint.method === "POST" ? "http" : "http";
}

function normalizeInteractionHints(hints?: InteractionHints): Required<InteractionHints> {
  return {
    toolCalling: hints?.toolCalling ?? true,
    httpExecution: hints?.httpExecution ?? true,
    streaming: hints?.streaming ?? false,
  };
}
