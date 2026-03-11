import { describe, it, expect } from "vitest";
import { enrichManifest } from "./enrich-capabilities.js";
import type { ModelClient } from "./model-client.js";
import type {
  AiCapabilitiesManifest,
  AiCapability,
  RiskLevel,
  ConfirmationPolicy,
} from "../types/index.js";
import type { CapabilityEnrichment } from "./enrich-types.js";

describe("enrichManifest", () => {
  it("adds semantic fields without mutating structural data", async () => {
    const manifest = createManifest([
      makeCapability("orders.create", "mutation", {
        description: "Create an order",
        inputSchema: { type: "object" },
      }),
      makeCapability("orders.read", "read", {
        description: "Read an order",
        inputSchema: { type: "object" },
      }),
    ]);

    const client = new StubModelClient([
      {
        userDescription: "Enriched description",
        aliases: ["create order"],
        exampleIntents: ["Create an order with items"],
      },
      {
        displayTitle: "View order",
        exampleIntents: ["Show order details"],
      },
    ]);

    const { manifest: enriched, diagnostics } = await enrichManifest(manifest, client);
    expect(diagnostics).toHaveLength(0);

    const createCap = enriched.capabilities[0]!;
    expect(createCap.id).toBe("orders.create");
    expect(createCap.kind).toBe("mutation");
    expect(createCap.inputSchema).toEqual({ type: "object" });
    expect(createCap.userDescription).toBe("Enriched description");
    expect(createCap.aliases).toEqual(["create order"]);
    expect(createCap.exampleIntents).toEqual(["Create an order with items"]);

    const readCap = enriched.capabilities[1]!;
    expect(readCap.displayTitle).toBe("orders.read");
    expect(readCap.exampleIntents).toEqual(["Show order details"]);
    expect(readCap.policy.visibility).toBe("internal");
    expect(readCap.sources[0].type).toBe("openapi");
  });

  it("skips invalid model output and emits warning", async () => {
    const manifest = createManifest([
      makeCapability("orders.create", "mutation", {
        description: "Create order",
        inputSchema: { type: "object" },
      }),
    ]);

    const client = new StubModelClient([
      {
        aliases: [123 as unknown as string],
      },
    ]);

    const { manifest: enriched, diagnostics } = await enrichManifest(manifest, client);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.capabilityId).toBe("orders.create");
    expect(enriched.capabilities[0]?.aliases).toBeUndefined();
    expect(enriched.capabilities[0]?.userDescription).toBeUndefined();
  });

  it("does not overwrite existing semantic fields", async () => {
    const manifest = createManifest([
      makeCapability("orders.route", "navigation", {
        description: "Go to order page",
        inputSchema: { type: "object" },
        aliases: ["Navigate orders"],
      }),
    ]);

    const client = new StubModelClient([
      {
        displayTitle: "New Title",
        aliases: ["Something else"],
      },
    ]);

    const { manifest: enriched } = await enrichManifest(manifest, client);
    const cap = enriched.capabilities[0]!;
    expect(cap.displayTitle).toBe("orders.route");
    expect(cap.aliases).toEqual(["Navigate orders"]);
  });
});

class StubModelClient implements ModelClient {
  readonly name = "stub";
  private readonly responses: (CapabilityEnrichment | { error: string })[];

  constructor(responses: (CapabilityEnrichment | { error: string })[]) {
    this.responses = [...responses];
  }

  async generateEnrichment(): Promise<CapabilityEnrichment | { error: string }> {
    if (this.responses.length === 0) {
      return { error: "No response queued" };
    }
    return this.responses.shift()!;
  }
}

function createManifest(capabilities: AiCapability[]): AiCapabilitiesManifest {
  return {
    manifestVersion: "1.0.0",
    generatedAt: "2026-03-10T00:00:00.000Z",
    app: { name: "Test App" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities,
  };
}

function makeCapability(
  id: string,
  kind: AiCapability["kind"],
  options: {
    description?: string;
    inputSchema: Record<string, unknown>;
    aliases?: string[];
  },
): AiCapability {
  return {
    id,
    kind,
    displayTitle: id,
    description: options.description ?? "",
    inputSchema: options.inputSchema,
    policy: defaultPolicy("internal", "low", "none"),
    tags: [],
    sources: [{ type: "openapi" }],
    metadata: {},
    aliases: options.aliases,
  };
}

function defaultPolicy(
  visibility: AiCapability["policy"]["visibility"],
  riskLevel: RiskLevel,
  confirmationPolicy: ConfirmationPolicy,
) {
  return {
    visibility,
    riskLevel,
    confirmationPolicy,
  };
}
