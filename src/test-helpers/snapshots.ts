import { relative, isAbsolute, sep } from "node:path";
import { projectRoot } from "./fixtures.js";

const DEFAULT_TIMESTAMP_KEYS = new Set([
  "generatedAt",
  "timestamp",
  "startedAt",
  "finishedAt",
  "createdAt",
  "updatedAt",
]);

const DEFAULT_ID_KEYS = new Set(["traceId", "requestId", "eventId"]);

const DEFAULT_PATH_KEYS = new Set([
  "filePath",
  "sourceProject",
  "configPath",
  "rawManifest",
  "canonicalManifest",
  "publicManifest",
  "enrichedManifest",
  "diagnosticsLog",
  "pilotReport",
  "pilotSummary",
  "tracesDir",
]);

const DEFAULT_DURATION_KEYS = new Set(["durationMs"]);

export interface SnapshotNormalizeOptions {
  timestampKeys?: string[];
  idKeys?: string[];
  pathKeys?: string[];
  dropKeys?: string[];
  durationKeys?: string[];
  rootDir?: string;
}

export function normalizeForSnapshot<T>(value: T, options: SnapshotNormalizeOptions = {}): T {
  const timestampKeys = new Set([
    ...DEFAULT_TIMESTAMP_KEYS,
    ...(options.timestampKeys ?? []),
  ]);
  const idKeys = new Set([...DEFAULT_ID_KEYS, ...(options.idKeys ?? [])]);
  const pathKeys = new Set([...DEFAULT_PATH_KEYS, ...(options.pathKeys ?? [])]);
  const dropKeys = new Set(options.dropKeys ?? []);
  const durationKeys = new Set([...DEFAULT_DURATION_KEYS, ...(options.durationKeys ?? [])]);
  const rootDir = options.rootDir ?? projectRoot();

  function normalizeNode(node: unknown): unknown {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) {
      return node.map((item) => normalizeNode(item));
    }
    if (typeof node === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, raw] of Object.entries(node as Record<string, unknown>)) {
        if (dropKeys.has(key)) continue;
        result[key] = transformValue(key, raw);
      }
      return result;
    }
    return node;
  }

  function transformValue(key: string, raw: unknown): unknown {
    if (timestampKeys.has(key)) {
      return "__SNAPSHOT_TIMESTAMP__";
    }
    if (idKeys.has(key)) {
      return "__SNAPSHOT_ID__";
    }
    if (durationKeys.has(key)) {
      return typeof raw === "number" ? 0 : "__SNAPSHOT_DURATION__";
    }
    if (pathKeys.has(key) && typeof raw === "string") {
      return normalizePath(raw, rootDir);
    }
    if (typeof raw === "object" && raw !== null) {
      return normalizeNode(raw);
    }
    if (typeof raw === "string" && raw.includes(rootDir)) {
      return normalizePath(raw, rootDir);
    }
    return raw;
  }

  return normalizeNode(value) as T;
}

function normalizePath(value: string, rootDir: string): string {
  if (isAbsolute(value) || value.startsWith(rootDir)) {
    const rel = relative(rootDir, value);
    return `<repo>/${rel.split(sep).join("/")}`;
  }
  return value.split(sep).join("/");
}

export function normalizeTextSnapshot(text: string, rootDir: string = projectRoot()): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z/g, "__SNAPSHOT_TIMESTAMP__")
    .replace(/- \*\*Trace ID:\*\* [A-Za-z0-9-]+/g, "- **Trace ID:** __SNAPSHOT_ID__")
    .split(rootDir)
    .join("<repo>")
    .replace(/\/var\/folders\/[^\s)]+/g, "<tmp>")
    .replace(/\/tmp\/[^\s)]+/g, "<tmp>");
}
