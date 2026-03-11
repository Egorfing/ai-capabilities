import type { ManifestAppInfo, ManifestDefaults, AiCapability, JsonSchema, CapabilityPolicy } from "../types/index.js";
import type { ExecutionMode } from "../runtime/runtime-types.js";

export interface EndpointReference {
  method: string;
  path: string;
  baseUrl?: string;
}

export interface InteractionHints {
  toolCalling?: boolean;
  httpExecution?: boolean;
  streaming?: boolean;
  [key: string]: boolean | undefined;
}

export interface WellKnownCapabilityExecution {
  mode?: string;
  endpoint?: EndpointReference;
}

export interface WellKnownCapability {
  id: string;
  kind: AiCapability["kind"];
  displayTitle: string;
  description: string;
  userDescription?: string;
  aliases?: string[];
  exampleIntents?: string[];
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  policy: CapabilityPolicy;
  execution?: WellKnownCapabilityExecution;
}

export interface DiscoveryMetadata {
  mode: ExecutionMode;
  executionEndpoint: EndpointReference;
  capabilitiesEndpoint: EndpointReference;
}

export interface PolicyHints {
  defaultVisibility: ManifestDefaults["visibility"];
  defaultRiskLevel: ManifestDefaults["riskLevel"];
  defaultConfirmationPolicy: ManifestDefaults["confirmationPolicy"];
  confirmationSupported: boolean;
}

export interface WellKnownResponse {
  manifestVersion: string;
  generatedAt: string;
  app: ManifestAppInfo;
  discovery: DiscoveryMetadata;
  policy: PolicyHints;
  interaction: Required<InteractionHints>;
  capabilities: WellKnownCapability[];
}
