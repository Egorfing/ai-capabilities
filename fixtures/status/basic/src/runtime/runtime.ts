import { CapabilityRuntime } from "ai-capabilities";
import manifest from "../../output/ai-capabilities.json" assert { type: "json" };
import { registry } from "../ai-capabilities/registry";

export const runtime = new CapabilityRuntime({ manifest, registry });
