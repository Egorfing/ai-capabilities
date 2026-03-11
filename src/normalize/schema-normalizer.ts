import type { RawCapability, JsonSchema, DiagnosticEntry } from "../types/index.js";
import { EXTRACTION_STAGE } from "../extractors/types.js";
import RefParser from "@apidevtools/json-schema-ref-parser";

export interface SchemaNormalizationOptions {
  maxDepth: number;
  resolveRefs: boolean;
}

export async function normalizeCapabilitySchemas(
  capabilities: RawCapability[],
  options: SchemaNormalizationOptions,
  diagnostics: DiagnosticEntry[],
): Promise<void> {
  for (const cap of capabilities) {
    if (cap.inputSchema) {
      cap.inputSchema = await normalizeSchema(cap, cap.inputSchema, "input", options, diagnostics);
    }
    if (cap.outputSchema) {
      cap.outputSchema = await normalizeSchema(cap, cap.outputSchema, "output", options, diagnostics);
    }
  }
}

async function normalizeSchema(
  cap: RawCapability,
  schema: JsonSchema,
  field: "input" | "output",
  options: SchemaNormalizationOptions,
  diagnostics: DiagnosticEntry[],
): Promise<JsonSchema> {
  let normalized = cloneSchema(schema);
  if (options.resolveRefs) {
    try {
      normalized = (await RefParser.dereference(normalized, {
        dereference: { circular: "ignore" },
      })) as JsonSchema;
    } catch (error) {
      diagnostics.push({
        level: "warning",
        stage: EXTRACTION_STAGE,
        sourceType: cap.source.type,
        capabilityId: cap.id,
        message: `Failed to resolve $ref in ${field} schema: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const truncated = limitDepthInPlace(normalized, options.maxDepth);
  if (truncated) {
    diagnostics.push({
      level: "info",
      stage: EXTRACTION_STAGE,
      sourceType: cap.source.type,
      capabilityId: cap.id,
      message: `Truncated ${field} schema to max depth ${options.maxDepth}`,
    });
  }

  cleanupSchema(normalized);
  return canonicalizeSchema(normalized);
}

function cloneSchema<T>(schema: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(schema);
  }
  return JSON.parse(JSON.stringify(schema)) as T;
}

function limitDepthInPlace(schema: JsonSchema, maxDepth: number): boolean {
  const visited = new WeakSet<object>();
  return limitDepthRecursive(schema as SchemaNode, 0, maxDepth, visited);
}

function limitDepthRecursive(
  node: SchemaNode,
  depth: number,
  maxDepth: number,
  visited: WeakSet<object>,
): boolean {
  if (!isRecord(node)) return false;
  if (visited.has(node)) return false;
  visited.add(node);

  if (depth >= maxDepth) {
    const replacement: SchemaNode = { type: "object", description: "Truncated schema" };
    for (const key of Object.keys(node)) {
      delete node[key];
    }
    Object.assign(node, replacement);
    return true;
  }

  let truncated = false;

  if (isRecord(node.properties)) {
    for (const value of Object.values(node.properties)) {
      truncated = limitDepthRecursive(value as SchemaNode, depth + 1, maxDepth, visited) || truncated;
    }
  }

  if (isRecord(node.additionalProperties)) {
    truncated =
      limitDepthRecursive(node.additionalProperties as SchemaNode, depth + 1, maxDepth, visited) ||
      truncated;
  }

  if (node.items) {
    if (Array.isArray(node.items)) {
      for (const item of node.items) {
        truncated = limitDepthRecursive(item as SchemaNode, depth + 1, maxDepth, visited) || truncated;
      }
    } else if (isRecord(node.items)) {
      truncated =
        limitDepthRecursive(node.items as SchemaNode, depth + 1, maxDepth, visited) || truncated;
    }
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    const arr = node[key];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        truncated = limitDepthRecursive(entry as SchemaNode, depth + 1, maxDepth, visited) || truncated;
      }
    }
  }

  return truncated;
}

function cleanupSchema(schema: JsonSchema): void {
  const visited = new WeakSet<object>();
  cleanupRecursive(schema as SchemaNode, visited);
}

function cleanupRecursive(node: SchemaNode, visited: WeakSet<object>): void {
  if (!isRecord(node)) return;
  if (visited.has(node)) return;
  visited.add(node);

  if (Array.isArray(node.required)) {
    const unique = Array.from(new Set(node.required.filter((r): r is string => typeof r === "string")));
    if (unique.length > 0) {
      unique.sort((a, b) => a.localeCompare(b));
      node.required = unique;
    } else {
      delete node.required;
    }
  }

  if (isRecord(node.properties)) {
    for (const value of Object.values(node.properties)) {
      cleanupRecursive(value as SchemaNode, visited);
    }
  }

  if (node.items) {
    if (Array.isArray(node.items)) {
      for (const entry of node.items) {
        cleanupRecursive(entry as SchemaNode, visited);
      }
    } else if (isRecord(node.items)) {
      cleanupRecursive(node.items as SchemaNode, visited);
    }
  }

  if (isRecord(node.additionalProperties)) {
    cleanupRecursive(node.additionalProperties as SchemaNode, visited);
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    const arr = node[key];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        cleanupRecursive(entry as SchemaNode, visited);
      }
    }
  }
}

type SchemaNode = JsonSchema & { [key: string]: any };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function canonicalizeSchema(schema: JsonSchema): JsonSchema {
  const visited = new WeakMap<object, unknown>();
  return canonicalizeNode(schema as SchemaNode, visited) as JsonSchema;
}

function canonicalizeNode(node: unknown, visited: WeakMap<object, unknown>): unknown {
  if (Array.isArray(node)) {
    if (visited.has(node)) {
      return visited.get(node);
    }
    const normalized: unknown[] = [];
    visited.set(node, normalized);
    for (const item of node) {
      normalized.push(canonicalizeNode(item, visited));
    }
    if (normalized.every(isPrimitive)) {
      const unique = Array.from(new Set(normalized as Primitive[])).sort(comparePrimitives);
      visited.set(node, unique);
      return unique;
    }
    return normalized;
  }

  if (isRecord(node)) {
    if (visited.has(node)) {
      return visited.get(node);
    }
    const orderedEntries = Object.entries(node)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => compareKeys(a, b));
    const normalized: Record<string, unknown> = {};
    visited.set(node, normalized);
    for (const [key, value] of orderedEntries) {
      normalized[key] = canonicalizeNode(value, visited);
    }
    return normalized;
  }

  return node;
}

type Primitive = string | number | boolean | null;

function isPrimitive(value: unknown): value is Primitive {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function comparePrimitives(a: Primitive, b: Primitive): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === typeof b) {
    if (typeof a === "boolean") {
      return Number(a) - Number(b as boolean);
    }
    return (a as string).localeCompare(b as string);
  }
  return primitiveRank(a) - primitiveRank(b);
}

function primitiveRank(value: Primitive): number {
  if (typeof value === "boolean") return 0;
  if (typeof value === "number") return 1;
  if (typeof value === "string") return 2;
  return 3; // null treated as object
}

function compareKeys(a: string, b: string): number {
  return a.localeCompare(b);
}
