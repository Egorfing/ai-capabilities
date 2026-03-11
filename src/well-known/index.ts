export type {
  EndpointReference,
  InteractionHints,
  WellKnownResponse,
  WellKnownCapability,
} from "./well-known-types.js";

export { buildWellKnownResponse } from "./build-well-known-response.js";
export { sanitizePublicCapabilities } from "./sanitize-public-capabilities.js";
