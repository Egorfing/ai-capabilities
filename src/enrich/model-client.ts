import type { CapabilityEnrichment } from "./enrich-types.js";

export interface ModelClient {
  readonly name: string;
  generateEnrichment(prompt: string): Promise<CapabilityEnrichment | { error: string }>;
}

export function createModelClient(name: string): ModelClient {
  switch ((name ?? "").toLowerCase()) {
    case "mock":
      return new MockModelClient();
    case "internal":
      return new InternalModelClient();
    default:
      throw new Error(`Unknown model "${name}". Supported models: mock, internal.`);
  }
}

class MockModelClient implements ModelClient {
  readonly name = "mock";

  async generateEnrichment(prompt: string): Promise<CapabilityEnrichment | { error: string }> {
    const payload = extractCapabilityPayload(prompt);
    if (!payload) {
      return { error: "Unable to parse capability payload from prompt" };
    }

    const baseName = (payload.id ?? "capability").replace(/[:._-]+/g, " ").trim();
    const alias = baseName.toLowerCase();

    return {
      displayTitle: `Handle ${baseName}`,
      userDescription: payload.description
        ? `${payload.description} (semantic view)`
        : `Capability ${payload.id}`,
      aliases: [alias, payload.id].filter(Boolean),
      exampleIntents: [`Use ${payload.id} in a flow`],
    };
  }
}

class InternalModelClient implements ModelClient {
  readonly name = "internal";

  async generateEnrichment(prompt: string): Promise<CapabilityEnrichment | { error: string }> {
    const payload = extractCapabilityPayload(prompt);
    if (!payload) {
      return { error: "Missing capability payload" };
    }

    const id: string = payload.id ?? "capability";
    const kind: string = payload.kind ?? "action";
    const severity = kind === "mutation" ? "medium" : "low";
    const confirmation = kind === "mutation" ? "once" : "none";

    return {
      userDescription:
        payload.description ??
        `Execute the ${kind} called ${id} with provided input schema.`,
      exampleIntents: [`${capitalize(kind)} ${id}`],
      riskLevel: severity as CapabilityEnrichment["riskLevel"],
      confirmationPolicy: confirmation as CapabilityEnrichment["confirmationPolicy"],
    };
  }
}

function extractCapabilityPayload(prompt: string): any | undefined {
  const marker = "Capability JSON:";
  const idx = prompt.indexOf(marker);
  if (idx === -1) return undefined;
  const braceIdx = prompt.indexOf("{", idx);
  if (braceIdx === -1) return undefined;
  let depth = 0;
  for (let i = braceIdx; i < prompt.length; i++) {
    const char = prompt[i];
    if (char === "{") depth++;
    else if (char === "}") depth--;
    if (depth === 0) {
      const jsonText = prompt.slice(braceIdx, i + 1);
      try {
        return JSON.parse(jsonText);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
