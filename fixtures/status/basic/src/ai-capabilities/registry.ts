import { CapabilityRegistry, registerCapabilityDefinitions } from "ai-capabilities";
import { authoredCapability } from "./capabilities/authored";

export const registry = new CapabilityRegistry();

registerCapabilityDefinitions(registry, [authoredCapability]);
