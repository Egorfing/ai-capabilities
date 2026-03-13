export { getWellKnownManifest, discoverCapabilities } from "./discover.js";
export { executeCapability } from "./execute.js";
export { AiCapabilitiesClientError } from "./errors.js";
export type {
  AbortSignalLike,
  ClientRequestOptions,
  DiscoverCapabilitiesOptions,
  DiscoverCapabilitiesResult,
  ExecuteCapabilityOptions,
  ExecuteCapabilityResult,
  ExecutionContextOptions,
  FetchLike,
  GetWellKnownOptions,
  WellKnownManifest,
} from "./types.js";
