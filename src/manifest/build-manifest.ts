import type { ResolvedConfig } from "../config/types.js";
import type {
  AiCapabilitiesManifest,
  AiCapability,
  CapabilityExecutionSpec,
  CapabilityExecutionEndpoint,
  CapabilityNavigationDescriptor,
} from "../types/index.js";
import type { RawCapability, CapabilitySource } from "../types/index.js";

export interface BuildManifestParams {
  capabilities: RawCapability[];
  config: ResolvedConfig;
  manifestVersion?: string;
  generatedAt?: string;
}

export interface BuildManifestResult {
  canonical: AiCapabilitiesManifest;
  publicManifest: AiCapabilitiesManifest;
}

const DEFAULT_MANIFEST_VERSION = "1.0.0";

export function buildAiCapabilitiesManifest(
  params: BuildManifestParams,
): BuildManifestResult {
  const { capabilities, config } = params;
  const manifestVersion = params.manifestVersion ?? DEFAULT_MANIFEST_VERSION;
  const generatedAt = params.generatedAt ?? new Date().toISOString();

  const canonicalCapabilities = capabilities.map((cap) =>
    toAiCapability(cap, config),
  );

  const canonical: AiCapabilitiesManifest = {
    manifestVersion,
    generatedAt,
    app: { ...config.manifest.app },
    defaults: { ...config.manifest.defaults },
    capabilities: canonicalCapabilities,
  };

  const publicCapabilities = canonicalCapabilities
    .filter((cap) => cap.policy.visibility === "public")
    .map(sanitizeForPublic);

  const publicManifest: AiCapabilitiesManifest = {
    manifestVersion,
    generatedAt,
    app: { ...canonical.app },
    defaults: { ...canonical.defaults },
    capabilities: publicCapabilities,
  };

  return { canonical, publicManifest };
}

function toAiCapability(cap: RawCapability, config: ResolvedConfig): AiCapability {
  const override = config.policy.overrides[cap.id] ?? {};
  const tags = dedupeStrings([...(cap.tags ?? []), ...(override.tags ?? [])]);
  const policy = {
    visibility: override.visibility ?? config.manifest.defaults.visibility,
    riskLevel: override.riskLevel ?? config.manifest.defaults.riskLevel,
    confirmationPolicy:
      override.confirmationPolicy ?? config.manifest.defaults.confirmationPolicy,
    permissionScope: Array.isArray(override.permissionScope)
      ? dedupeStrings(override.permissionScope)
      : undefined,
  };

  const aliases = readStringArray(cap.metadata, "aliases");
  const exampleIntents = readStringArray(cap.metadata, "exampleIntents");
  const execution = readExecution(cap.metadata);
  const navigation = readNavigation(cap.metadata);
  const sources = (cap.sources ?? [cap.source]).map((source) => ({ ...source }));
  const effects = cap.effects?.map((effect) => ({ type: effect }));

  const displayTitle = pickDisplayTitle(cap);
  const description = cap.description?.trim() || displayTitle;

  return {
    id: cap.id,
    kind: cap.kind,
    displayTitle,
    description,
    aliases,
    exampleIntents,
    inputSchema: cap.inputSchema,
    outputSchema: cap.outputSchema,
    execution,
    policy,
    effects,
    navigation,
    tags: tags.length > 0 ? tags : undefined,
    sources,
    diagnostics: undefined,
    metadata: cap.metadata,
  };
}

function pickDisplayTitle(cap: RawCapability): string {
  if (cap.title && typeof cap.title === "string" && cap.title.trim().length > 0) {
    return cap.title.trim();
  }
  return humanizeId(cap.id);
}

function humanizeId(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readStringArray(metadata: Record<string, unknown>, key: string): string[] | undefined {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return undefined;
  const arr = value.filter((entry): entry is string => typeof entry === "string");
  return arr.length > 0 ? dedupeStrings(arr) : undefined;
}

function readExecution(metadata: Record<string, unknown>): CapabilityExecutionSpec | undefined {
  const value = metadata["execution"];
  if (!value || typeof value !== "object") return undefined;
  const mode = (value as Record<string, unknown>).mode;
  if (typeof mode !== "string") return undefined;
  const exec: CapabilityExecutionSpec = {
    mode: mode as CapabilityExecutionSpec["mode"],
  };
  const record = value as Record<string, unknown>;
  if (typeof record.handlerRef === "string") {
    exec.handlerRef = record.handlerRef;
  }
  if (typeof record.timeoutMs === "number") {
    exec.timeoutMs = record.timeoutMs;
  }
  const endpoint = parseExecutionEndpoint(record.endpoint);
  if (endpoint) {
    exec.endpoint = endpoint;
  }
  return exec;
}

function parseExecutionEndpoint(value: unknown): CapabilityExecutionEndpoint | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.method !== "string" || typeof record.path !== "string") {
    return undefined;
  }
  const endpoint: CapabilityExecutionEndpoint = {
    method: record.method,
    path: record.path,
  };
  if (typeof record.baseUrl === "string") endpoint.baseUrl = record.baseUrl;
  if (record.headers && typeof record.headers === "object") {
    const headers = normalizeStringMap(record.headers);
    if (Object.keys(headers).length > 0) {
      endpoint.headers = headers;
    }
  }
  return endpoint;
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === "string") {
      result[key] = val;
    }
  }
  return result;
}

function readNavigation(metadata: Record<string, unknown>): CapabilityNavigationDescriptor | undefined {
  const value = metadata["navigation"];
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const navigation: CapabilityNavigationDescriptor = {};
  if (typeof record.route === "string") navigation.route = record.route;
  if (typeof record.openAfterSuccess === "boolean") {
    navigation.openAfterSuccess = record.openAfterSuccess;
  }
  return Object.keys(navigation).length > 0 ? navigation : undefined;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0)));
}

function sanitizeForPublic(cap: AiCapability): AiCapability {
  const execution = cap.execution ? { ...cap.execution } : undefined;
  if (execution) {
    delete execution.handlerRef;
  }
  const sources = cap.sources.map((source) => sanitizeSource(source));
  return {
    ...cap,
    execution,
    sources,
    diagnostics: undefined,
    metadata: undefined,
  };
}

function sanitizeSource(source: CapabilitySource): CapabilitySource {
  return { type: source.type };
}
