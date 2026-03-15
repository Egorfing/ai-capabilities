import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";
import type { AiCapabilitiesManifest } from "../types/index.js";

export type ManifestVisibility = "public" | "internal";

export interface ManifestLoaderOptions {
  runtimeUrl?: string;
  publicManifestUrl?: string;
  localPath?: string;
  expectedVisibility: ManifestVisibility;
  preferRemote?: boolean;
  allowFallback?: boolean;
  cacheTtlMs?: number;
  logger?: ManifestLoaderLogger;
  fetchFn?: typeof fetch;
}

export interface ManifestLoaderLogger {
  info?(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface ManifestSourcePlan {
  kind: "remote" | "local";
  detail: string;
  visibility: ManifestVisibility;
  description: string;
}

export interface ManifestLoadResult {
  manifest: AiCapabilitiesManifest;
  sourceKind: ManifestSourcePlan["kind"];
  sourceDetail: string;
  visibility: ManifestVisibility;
  usedFallback: boolean;
  usedCache: boolean;
  warnings: string[];
}

const REMOTE_CACHE = new Map<string, { manifest: AiCapabilitiesManifest; expiresAt: number }>();

export function resolveManifestSources(options: ManifestLoaderOptions): ManifestSourcePlan[] {
  const expected = options.expectedVisibility;
  const remoteCandidates: ManifestSourcePlan[] = [];
  const localCandidates: ManifestSourcePlan[] = [];

  if (options.publicManifestUrl) {
    if (expected !== "public") {
      throw new Error("publicManifestUrl can only be used when expectedVisibility is 'public'");
    }
    remoteCandidates.push({
      kind: "remote",
      detail: normalizeUrl(options.publicManifestUrl),
      visibility: "public",
      description: "public-manifest-url",
    });
  }

  if (options.runtimeUrl) {
    const runtimeBase = normalizeUrl(options.runtimeUrl, true);
    if (expected === "public") {
      const publicUrl = new URL("/capabilities?visibility=public", runtimeBase).toString();
      remoteCandidates.push({
        kind: "remote",
        detail: publicUrl,
        visibility: "public",
        description: "runtime-public",
      });
    } else {
      const internalUrl = new URL("/capabilities", runtimeBase).toString();
      remoteCandidates.push({
        kind: "remote",
        detail: internalUrl,
        visibility: "internal",
        description: "runtime-internal",
      });
    }
  }

  if (options.localPath) {
    const resolved = resolvePath(options.localPath);
    localCandidates.push({
      kind: "local",
      detail: resolved,
      visibility: expected,
      description: "local-file",
    });
  }

  const preferRemote = options.preferRemote ?? (expected === "public");
  const ordered = preferRemote
    ? [...remoteCandidates, ...localCandidates]
    : [...localCandidates, ...remoteCandidates];

  return ordered;
}

export async function loadManifest(options: ManifestLoaderOptions): Promise<ManifestLoadResult> {
  const sources = resolveManifestSources(options);
  if (sources.length === 0) {
    throw new Error("No manifest sources provided. Specify runtimeUrl and/or localPath.");
  }

  const warnings: string[] = [];
  let usedFallback = false;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    try {
      const { manifest, usedCache } =
        source.kind === "remote"
          ? await loadRemoteManifest(source, options)
          : await loadLocalManifest(source);

      ensureVisibility(manifest, options.expectedVisibility, source);

      return {
        manifest,
        sourceKind: source.kind,
        sourceDetail: source.detail,
        visibility: options.expectedVisibility,
        usedFallback,
        usedCache,
        warnings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to load ${source.description} (${source.detail}): ${message}`);
      options.logger?.warn?.(warnings[warnings.length - 1]);
      const hasNext = i < sources.length - 1;
      if (!options.allowFallback || !hasNext) {
        throw new Error(message);
      }
      usedFallback = true;
    }
  }
  throw new Error("Failed to load manifest from any source");
}

async function loadRemoteManifest(
  source: ManifestSourcePlan,
  options: ManifestLoaderOptions,
): Promise<{ manifest: AiCapabilitiesManifest; usedCache: boolean }> {
  const fetchImpl = options.fetchFn ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("fetch API is not available in this environment");
  }

  const cacheKey = `${source.detail}|${source.visibility}`;
  const ttl = options.cacheTtlMs ?? 0;
  if (ttl > 0) {
    const cached = REMOTE_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { manifest: cached.manifest, usedCache: true };
    }
  }

  const response = await fetchImpl(source.detail, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const body = await response.json();
  const manifest = normalizeManifestShape(body);

  if (ttl > 0) {
    REMOTE_CACHE.set(cacheKey, { manifest, expiresAt: Date.now() + ttl });
  }

  return { manifest, usedCache: false };
}

async function loadLocalManifest(source: ManifestSourcePlan): Promise<{ manifest: AiCapabilitiesManifest; usedCache: boolean }> {
  if (!existsSync(source.detail)) {
    throw new Error(`File not found at ${source.detail}`);
  }
  const raw = await readFile(source.detail, "utf-8");
  const json = JSON.parse(raw);
  const manifest = normalizeManifestShape(json);
  return { manifest, usedCache: false };
}

function ensureVisibility(
  manifest: AiCapabilitiesManifest,
  expected: ManifestVisibility,
  source: ManifestSourcePlan,
): void {
  if (expected === "public") {
    const hasInternal = manifest.capabilities.some((cap) => cap.policy.visibility !== "public");
    if (hasInternal) {
      throw new Error(`Expected public manifest but source returned internal capabilities (${source.detail})`);
    }
  }
}

function normalizeManifestShape(payload: unknown): AiCapabilitiesManifest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Manifest payload is not an object");
  }
  const manifest = payload as Partial<AiCapabilitiesManifest>;
  if (!Array.isArray(manifest.capabilities)) {
    throw new Error("Manifest payload is missing capabilities array");
  }
  return manifest as AiCapabilitiesManifest;
}

function normalizeUrl(value: string, ensureTrailingSlash = false): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (ensureTrailingSlash && !trimmed.endsWith("/")) {
    return `${trimmed}/`;
  }
  return trimmed;
}
