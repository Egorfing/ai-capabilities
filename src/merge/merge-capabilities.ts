import type { RawCapability, CapabilitySource, JsonSchema } from "../types/index.js";

const PRIORITY: Record<string, number> = {
  openapi: 1,
  "react-query": 2,
  form: 3,
  router: 4,
};

export interface MergeResult {
  capabilities: RawCapability[];
  groups: number;
}

export function mergeCapabilities(capabilities: RawCapability[]): MergeResult {
  const groups = new Map<string, RawCapability[]>();

  for (const cap of capabilities) {
    const key = deriveIdentity(cap);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cap);
  }

  const merged: RawCapability[] = [];
  for (const caps of groups.values()) {
    merged.push(mergeGroup(caps));
  }

  return { capabilities: merged, groups: groups.size };
}

function mergeGroup(group: RawCapability[]): RawCapability {
  const sorted = [...group].sort((a, b) => comparePriority(a.source.type, b.source.type));
  const primary = sorted[0]!;
  const base: RawCapability = {
    ...primary,
    tags: [...(primary.tags ?? [])],
    effects: [...(primary.effects ?? [])],
    metadata: { ...(primary.metadata ?? {}) },
  };

  const allSources: CapabilitySource[] = [];
  const tagSet = new Set(base.tags);
  const effectSet = new Set(base.effects);
  const metadata = base.metadata;

  for (const cap of sorted) {
    allSources.push(cap.source);
    cap.tags?.forEach((tag) => tagSet.add(tag));
    cap.effects?.forEach((effect) => effectSet.add(effect));
    for (const [key, value] of Object.entries(cap.metadata ?? {})) {
      if (metadata[key] === undefined) {
        metadata[key] = value;
      }
    }
  }

  base.tags = [...tagSet];
  base.effects = [...effectSet];
  base.metadata = metadata;
  const sources = dedupeSources(allSources);
  if (sources) {
    base.sources = sources;
  } else {
    delete base.sources;
  }
  base.inputSchema = selectBestSchema(sorted);
  if (!base.outputSchema) {
    base.outputSchema = sorted.find((cap) => cap.outputSchema)?.outputSchema;
  }

  return base;
}

function comparePriority(a: string, b: string): number {
  const pa = PRIORITY[a] ?? 100;
  const pb = PRIORITY[b] ?? 100;
  return pa - pb;
}

function dedupeSources(sources: CapabilitySource[]): CapabilitySource[] | undefined {
  const seen = new Set<string>();
  const result: CapabilitySource[] = [];
  for (const src of sources) {
    const key = `${src.type}:${src.filePath ?? ""}:${src.location ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(src);
  }
  return result.length > 1 ? result : undefined;
}

function deriveIdentity(cap: RawCapability): string {
  const metadata = cap.metadata ?? {};
  if (typeof metadata.identity === "string") {
    return normalizeSlug(metadata.identity);
  }
  if (typeof metadata.operationId === "string") {
    return normalizeSlug(metadata.operationId);
  }
  if (typeof metadata.hookName === "string") {
    return normalizeSlug(metadata.hookName.replace(/^use/, ""));
  }
  if (typeof metadata.path === "string") {
    return normalizeSlug(metadata.path.replace(/[{}:]/g, ""));
  }
  const part = cap.id.includes(".") ? cap.id.split(".").slice(1).join(".") : cap.id;
  return normalizeSlug(part);
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function selectBestSchema(group: RawCapability[]): JsonSchema {
  let selected = group[0]!.inputSchema;
  let score = schemaScore(selected);
  let selectedType = group[0]!.source.type;

  for (const cap of group) {
    const candidate = cap.inputSchema;
    const candidateScore = schemaScore(candidate);
    if (candidateScore === 0) continue;
    if (candidateScore > score) {
      selected = candidate;
      score = candidateScore;
      selectedType = cap.source.type;
    } else if (candidateScore === score) {
      if (comparePriority(cap.source.type, selectedType) < 0) {
        selected = candidate;
        selectedType = cap.source.type;
      }
    }
  }

  return selected;
}

function schemaScore(schema: JsonSchema | undefined): number {
  if (!schema) return 0;
  if (schema.type === "object" && schema.properties) {
    return Object.keys(schema.properties as Record<string, unknown>).length || 1;
  }
  return 1;
}
