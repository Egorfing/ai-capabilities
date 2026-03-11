import { describe, it, expect, beforeAll } from "vitest";
import { loadConfig } from "../config/load-config.js";
import type { ResolvedConfig } from "../config/types.js";
import { defaultRegistry, runPipeline } from "../extractors/index.js";
import { mergeCapabilities } from "../merge/merge-capabilities.js";
import { buildAiCapabilitiesManifest } from "./build-manifest.js";
import type {
  RawCapabilityManifest,
  AiCapabilitiesManifest,
} from "../types/index.js";
import { DEMO_APP_PATH, DEMO_CONFIG_PATH, readGoldenJson } from "../test-helpers/fixtures.js";
import { normalizeForSnapshot } from "../test-helpers/snapshots.js";
import { enrichManifest } from "../enrich/enrich-capabilities.js";
import { createModelClient } from "../enrich/model-client.js";

describe("demo app manifest contract", () => {
  let config: ResolvedConfig;
  let rawManifest: RawCapabilityManifest;
  let canonical: AiCapabilitiesManifest;
  let publicManifest: AiCapabilitiesManifest;
  let enrichedManifest: AiCapabilitiesManifest;

  beforeAll(async () => {
    config = await loadConfig({ configPath: DEMO_CONFIG_PATH });

    const pipeline = await runPipeline(defaultRegistry, { projectPath: DEMO_APP_PATH, config });
    const merged = mergeCapabilities(pipeline.capabilities);

    rawManifest = {
      meta: {
        generatedAt: new Date().toISOString(),
        sourceProject: DEMO_APP_PATH,
        extractors: pipeline.extractorsRun,
        version: "0.1.0",
      },
      capabilities: merged.capabilities,
    };

    const manifests = buildAiCapabilitiesManifest({
      capabilities: merged.capabilities,
      config,
    });

    canonical = manifests.canonical;
    publicManifest = manifests.publicManifest;

    const { manifest: enriched } = await enrichManifest(
      canonical,
      createModelClient("mock"),
    );
    enrichedManifest = enriched;
  });

  it("matches raw manifest golden snapshot", () => {
    const actual = normalizeForSnapshot(rawManifest);
    const expected = normalizeForSnapshot(
      readGoldenJson<RawCapabilityManifest>("demo-app", "capabilities.raw.json"),
    );
    expect(actual).toEqual(expected);
  });

  it("matches canonical manifest golden snapshot", () => {
    const actual = normalizeForSnapshot(canonical);
    const expected = normalizeForSnapshot(
      readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.json"),
    );
    expect(actual).toEqual(expected);
  });

  it("matches public manifest golden snapshot", () => {
    const actual = normalizeForSnapshot(publicManifest);
    const expected = normalizeForSnapshot(
      readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.public.json"),
    );
    expect(actual).toEqual(expected);
  });

  it("matches enriched manifest golden snapshot", () => {
    const actual = normalizeForSnapshot(enrichedManifest);
    const expected = normalizeForSnapshot(
      readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.enriched.json"),
    );
    expect(actual).toEqual(expected);
  });

  it("canonical manifest invariants hold", () => {
    const ids = new Set<string>();
    for (const capability of canonical.capabilities) {
      expect(capability.id).toMatch(/^[a-z0-9._-]+$/i);
      expect(ids.has(capability.id)).toBe(false);
      ids.add(capability.id);
      expect(capability.inputSchema).toBeDefined();
      expect(capability.policy.visibility).toMatch(/^(public|internal)$/);
      if (capability.execution?.endpoint) {
        expect(typeof capability.execution.endpoint.method).toBe("string");
        expect(capability.execution.endpoint.path).toMatch(/^\//);
      }
      expect(capability.sources.length).toBeGreaterThan(0);
    }
  });

  it("public manifest never leaks handlerRef or metadata", () => {
    for (const capability of publicManifest.capabilities) {
      expect(capability.execution?.handlerRef).toBeUndefined();
      expect(capability.metadata).toBeUndefined();
      expect(capability.sources.every((source) => Object.keys(source).length === 1)).toBe(true);
    }
  });
});
