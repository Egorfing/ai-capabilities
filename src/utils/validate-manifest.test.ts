import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateRawManifest, validateEnrichedManifest } from "./validate-manifest.js";

const root = resolve(import.meta.dirname, "../../docs/contract");

const rawManifest = JSON.parse(
  readFileSync(resolve(root, "capabilities.raw.json"), "utf-8"),
);

const enrichedManifest = JSON.parse(
  readFileSync(resolve(root, "capabilities.enriched.json"), "utf-8"),
);

describe("validateRawManifest", () => {
  it("accepts the example raw manifest", () => {
    const result = validateRawManifest(rawManifest);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rejects a completely empty object", () => {
    const result = validateRawManifest({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a capability with invalid id", () => {
    const bad = {
      meta: { generatedAt: "2025-01-01T00:00:00Z", version: "0.1.0" },
      capabilities: [
        {
          id: "UPPER_CASE",
          source: { type: "openapi" },
          kind: "read",
          inputSchema: {},
          metadata: {},
        },
      ],
    };
    const result = validateRawManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("id"))).toBe(true);
  });
});

describe("validateEnrichedManifest", () => {
  it("accepts the example enriched manifest", () => {
    const result = validateEnrichedManifest(enrichedManifest);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rejects raw manifest as enriched (missing enriched fields)", () => {
    const result = validateEnrichedManifest(rawManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("displayTitle"))).toBe(true);
  });
});
