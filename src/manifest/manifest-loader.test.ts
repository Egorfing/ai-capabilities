import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AiCapabilitiesManifest } from "../types/index.js";
import { loadManifest } from "./manifest-loader.js";

const SAMPLE_MANIFEST: AiCapabilitiesManifest = {
  manifestVersion: "1.0.0",
  generatedAt: "2026-03-14T12:00:00.000Z",
  app: { name: "Test" },
  defaults: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
  capabilities: [
    {
      id: "cap.public",
      kind: "read",
      displayTitle: "Public cap",
      description: "desc",
      inputSchema: { type: "object" },
      policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
      sources: [{ type: "manual" }],
    },
  ],
};

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "ai-manifest-loader-"));
}

describe("manifest loader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads manifest from local file", async () => {
    const dir = tempDir();
    const file = join(dir, "ai-capabilities.json");
    writeFileSync(file, JSON.stringify(SAMPLE_MANIFEST, null, 2));

    const result = await loadManifest({
      localPath: file,
      expectedVisibility: "internal",
      preferRemote: false,
    });

    expect(result.sourceKind).toBe("local");
    expect(result.manifest.capabilities).toHaveLength(1);
  });

  it("loads public manifest from remote runtime", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_MANIFEST), { status: 200 }),
    );
    const result = await loadManifest({
      runtimeUrl: "https://example.com",
      expectedVisibility: "public",
      fetchFn: fetchMock,
    });

    expect(result.sourceKind).toBe("remote");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/capabilities?visibility=public", expect.any(Object));
    expect(result.manifest.capabilities[0]?.id).toBe("cap.public");
  });

  it("falls back to local file when remote fails", async () => {
    const dir = tempDir();
    const file = join(dir, "ai-capabilities.public.json");
    writeFileSync(file, JSON.stringify(SAMPLE_MANIFEST, null, 2));

    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    const result = await loadManifest({
      runtimeUrl: "https://offline.app",
      localPath: file,
      expectedVisibility: "public",
      allowFallback: true,
      fetchFn: fetchMock,
    });

    expect(result.sourceKind).toBe("local");
    expect(result.usedFallback).toBe(true);
  });

  it("caches remote manifest when ttl is set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(SAMPLE_MANIFEST), { status: 200 }));

    const options = {
      runtimeUrl: "https://cache.app",
      expectedVisibility: "public",
      cacheTtlMs: 5000,
      fetchFn: fetchMock,
    } as const;

    const first = await loadManifest(options);
    const second = await loadManifest(options);
    expect(first.usedCache).toBe(false);
    expect(second.usedCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when public manifest includes internal capability", async () => {
    const badManifest: AiCapabilitiesManifest = {
      ...SAMPLE_MANIFEST,
      capabilities: [
        SAMPLE_MANIFEST.capabilities[0]!,
        {
          id: "cap.internal",
          kind: "mutation",
          displayTitle: "Internal",
          description: "desc",
          inputSchema: { type: "object" },
          policy: { visibility: "internal", riskLevel: "high", confirmationPolicy: "once" },
          sources: [{ type: "manual" }],
        },
      ],
    };

    const dir = tempDir();
    const file = join(dir, "ai-capabilities.public.json");
    writeFileSync(file, JSON.stringify(badManifest, null, 2));

    await expect(
      loadManifest({ localPath: file, expectedVisibility: "public" }),
    ).rejects.toThrow(/Expected public manifest/);
  });
});
