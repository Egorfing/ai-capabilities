import type {
  DiscoverCapabilitiesOptions,
  DiscoverCapabilitiesResult,
  GetWellKnownOptions,
  WellKnownManifest,
} from "./types.js";
import { ensureSuccessEnvelope, requestJson, resolveEndpoint } from "./http.js";

const WELL_KNOWN_PATH = "/.well-known/ai-capabilities.json";

export async function getWellKnownManifest(
  baseUrl: string,
  options?: GetWellKnownOptions,
): Promise<WellKnownManifest> {
  const url = resolveEndpoint(baseUrl, WELL_KNOWN_PATH);
  const payload = await requestJson<WellKnownManifest>(url, { method: "GET" }, options);
  const envelope = ensureSuccessEnvelope(payload, url);
  return envelope.data;
}

export async function discoverCapabilities(
  baseUrl: string,
  options?: DiscoverCapabilitiesOptions,
): Promise<DiscoverCapabilitiesResult> {
  const manifest = await getWellKnownManifest(baseUrl, options);
  const lookup = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));

  return {
    manifest,
    capabilities: manifest.capabilities,
    getCapabilityById(capabilityId: string) {
      return lookup.get(capabilityId);
    },
  };
}
