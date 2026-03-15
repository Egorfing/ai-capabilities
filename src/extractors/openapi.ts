// ---------------------------------------------------------------------------
// OpenAPI extractor: parse OpenAPI 3.x / Swagger 2.0 specs → RawCapability[]
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type {
  RawCapability,
  CapabilityKind,
  CapabilityEffect,
  DiagnosticEntry,
} from "../types/index.js";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.js";
import { EXTRACTION_STAGE } from "./types.js";

// File names we look for in the project root
const SPEC_FILENAMES = [
  "openapi.json",
  "openapi.yaml",
  "openapi.yml",
  "swagger.json",
  "swagger.yaml",
  "swagger.yml",
];

type SpecVersion = "openapi3" | "swagger2";

// HTTP methods we care about
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function detectSpecVersion(spec: Record<string, unknown>): SpecVersion | undefined {
  const openapi = spec.openapi as string | undefined;
  if (typeof openapi === "string" && openapi.trim().startsWith("3")) {
    return "openapi3";
  }
  const swagger = spec.swagger as string | undefined;
  if (typeof swagger === "string" && swagger.trim().startsWith("2")) {
    return "swagger2";
  }
  return undefined;
}

function mergeParameters(
  pathParams: Record<string, unknown>[],
  operationParams: Record<string, unknown>[],
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  const add = (param: Record<string, unknown>) => {
    const name = (param.name as string | undefined) ?? "__unnamed";
    const loc = ((param.in as string | undefined) ?? "query").toLowerCase();
    map.set(`${loc}:${name}`, param);
  };
  for (const param of pathParams) add(param);
  for (const param of operationParams) add(param);
  return Array.from(map.values());
}

function partitionSwaggerParameters(params: Record<string, unknown>[]): {
  filteredParams: Record<string, unknown>[];
  swaggerBodySchema?: Record<string, unknown>;
} {
  const filtered: Record<string, unknown>[] = [];
  let bodySchema: Record<string, unknown> | undefined;
  for (const param of params) {
    const location = typeof param.in === "string" ? param.in.toLowerCase() : undefined;
    if (location === "body") {
      bodySchema = (param.schema as Record<string, unknown>) ?? undefined;
      continue;
    }
    filtered.push(param);
  }
  return { filteredParams: filtered, swaggerBodySchema: bodySchema };
}

function extractSchemaFromParameter(param: Record<string, unknown>): Record<string, unknown> {
  const schema = param.schema as Record<string, unknown> | undefined;
  if (schema && typeof schema === "object") {
    return schema;
  }
  const derived: Record<string, unknown> = {};
  const type = param.type as string | undefined;
  if (type) derived.type = type;
  if (param.items) derived.items = param.items;
  if (param.enum) derived.enum = param.enum;
  if (param.format) derived.format = param.format;
  if (Object.keys(derived).length === 0) {
    derived.type = "string";
  }
  return derived;
}

// ---- Helpers ---------------------------------------------------------------

function slugify(path: string): string {
  return path
    .replace(/^\//, "")
    .replace(/[{}]/g, "")
    .replace(/[/_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "");
}

/** Convert camelCase to kebab-case: "listOrders" → "list-orders" */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function methodToKind(method: HttpMethod): CapabilityKind {
  return method === "get" ? "read" : "mutation";
}

function methodToEffects(method: HttpMethod): CapabilityEffect[] {
  if (method === "get") return ["network-request"];
  return ["network-request", "state-mutation"];
}

function buildCapabilityId(
  method: HttpMethod,
  path: string,
  operationId?: string,
  tag?: string,
): string {
  if (operationId) {
    const prefix = tag ? `api.${tag.toLowerCase()}` : "api";
    return `${prefix}.${camelToKebab(operationId)}`;
  }
  return `api.${method}.${slugify(path)}`;
}

/** Extract JSON Schema for parameters (query + path → object schema). */
function parametersToSchema(
  params: Record<string, unknown>[] | undefined,
): Record<string, unknown> {
  if (!params || params.length === 0) {
    return { type: "object", properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const p of params) {
    const name = p.name as string | undefined;
    if (!name) continue;
    const location = typeof p.in === "string" ? p.in.toLowerCase() : undefined;
    if (location && !["query", "path", "cookie", "formdata"].includes(location)) {
      continue;
    }
    properties[name] = extractSchemaFromParameter(p);
    if (p.required || location === "path") required.push(name);
  }

  const schema: Record<string, unknown> = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

/** Extract request body schema (first content type). */
function requestBodySchema(
  body: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!body) return undefined;
  const content = body.content as Record<string, unknown> | undefined;
  if (!content) return undefined;

  // Prefer application/json, fall back to first available
  const jsonContent = content["application/json"] as Record<string, unknown> | undefined;
  const first = jsonContent ?? (Object.values(content)[0] as Record<string, unknown> | undefined);
  return (first?.schema as Record<string, unknown>) ?? undefined;
}

/** Extract response schema from first 2xx response. */
function responseSchema(
  responses: Record<string, unknown> | undefined,
  version: SpecVersion,
): Record<string, unknown> | undefined {
  if (!responses) return undefined;

  for (const code of Object.keys(responses)) {
    if (!code.startsWith("2")) continue;
    const resp = responses[code] as Record<string, unknown>;
    if (version === "swagger2") {
      const schema = resp?.schema as Record<string, unknown> | undefined;
      if (schema) return schema;
      continue;
    }
    const content = resp?.content as Record<string, unknown> | undefined;
    if (!content) continue;
    const jsonContent = content["application/json"] as Record<string, unknown> | undefined;
    const first = jsonContent ?? (Object.values(content)[0] as Record<string, unknown> | undefined);
    if (first?.schema) return first.schema as Record<string, unknown>;
  }

  return undefined;
}

/** Merge parameter schema with request body schema into a single input schema. */
function mergeInputSchemas(
  paramSchema: Record<string, unknown>,
  bodySchema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!bodySchema) return paramSchema;

  const paramProps = (paramSchema.properties ?? {}) as Record<string, unknown>;
  const paramRequired = (paramSchema.required ?? []) as string[];

  // If body is an object schema, merge its properties
  if (bodySchema.type === "object" && bodySchema.properties) {
    const bodyProps = bodySchema.properties as Record<string, unknown>;
    const bodyRequired = (bodySchema.required ?? []) as string[];
    const merged: Record<string, unknown> = {
      type: "object",
      properties: { ...paramProps, ...bodyProps },
    };
    const allRequired = [...paramRequired, ...bodyRequired];
    if (allRequired.length > 0) merged.required = allRequired;
    return merged;
  }

  // Non-object body: wrap as "body" property
  const merged: Record<string, unknown> = {
    type: "object",
    properties: { ...paramProps, body: bodySchema },
  };
  const allRequired = [...paramRequired, "body"];
  if (allRequired.length > 0) merged.required = allRequired;
  return merged;
}

// ---- Spec loading ----------------------------------------------------------

function findSpecFiles(projectPath: string): string[] {
  const found: string[] = [];
  for (const name of SPEC_FILENAMES) {
    const full = join(projectPath, name);
    if (existsSync(full)) found.push(full);
  }
  return found;
}

function resolveSpecFiles(ctx: ExtractionContext, diagnostics: DiagnosticEntry[]): string[] {
  const configured = ctx.config.extractors.openapi.spec;
  if (configured.length > 0) {
    const existing: string[] = [];
    for (const spec of configured) {
      if (existsSync(spec)) {
        existing.push(spec);
      } else {
        diagnostics.push({
          level: "warning",
          stage: EXTRACTION_STAGE,
          sourceType: "openapi",
          filePath: spec,
          message: `Configured OpenAPI spec not found: ${spec}`,
        });
      }
    }
    return existing;
  }

  return findSpecFiles(ctx.projectPath);
}

function loadSpec(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  return yaml.load(raw) as Record<string, unknown>;
}

// ---- Main extractor --------------------------------------------------------

function extractFromSpec(
  spec: Record<string, unknown>,
  specFilePath: string,
  diagnostics: DiagnosticEntry[],
): { capabilities: RawCapability[]; supported: boolean } {
  const specVersion = detectSpecVersion(spec);
  if (!specVersion) {
    diagnostics.push({
      level: "error",
      stage: EXTRACTION_STAGE,
      sourceType: "openapi",
      message: "Unsupported spec: missing 'openapi' (3.x) or 'swagger' (2.0) version field.",
      filePath: specFilePath,
    });
    return { capabilities: [], supported: false };
  }
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) {
    diagnostics.push({
      level: "warning",
      stage: EXTRACTION_STAGE,
      sourceType: "openapi",
      message: "No 'paths' found in spec.",
      filePath: specFilePath,
    });
    return { capabilities: [], supported: true };
  }

  const capabilities: RawCapability[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const operationId = operation.operationId as string | undefined;
      const tags = operation.tags as string[] | undefined;
      const tag = tags?.[0];

      const id = buildCapabilityId(method, path, operationId, tag);
      const mergedParams = mergeParameters(
        (pathItem.parameters as Record<string, unknown>[]) ?? [],
        (operation.parameters as Record<string, unknown>[]) ?? [],
      );
      const { filteredParams, swaggerBodySchema } =
        specVersion === "swagger2" ? partitionSwaggerParameters(mergedParams) : { filteredParams: mergedParams, swaggerBodySchema: undefined };
      const paramSchema = parametersToSchema(filteredParams);
      const bodySchema =
        specVersion === "swagger2"
          ? swaggerBodySchema
          : requestBodySchema(operation.requestBody as Record<string, unknown> | undefined);
      const inputSchema = mergeInputSchemas(paramSchema, bodySchema);
      const outputSchema = responseSchema(
        operation.responses as Record<string, unknown> | undefined,
        specVersion,
      );

      const cap: RawCapability = {
        id,
        source: {
          type: "openapi",
          filePath: specFilePath,
          location: `${method.toUpperCase()} ${path}`,
        },
        kind: methodToKind(method),
        title: (operation.summary as string) ?? undefined,
        description: (operation.description as string) ?? undefined,
        inputSchema,
        outputSchema,
        effects: methodToEffects(method),
        tags: tags ?? [],
        metadata: {
          operationId,
          method: method.toUpperCase(),
          path,
        },
      };

      capabilities.push(cap);
    }
  }

  return { capabilities, supported: true };
}

// ---- Extractor implementation ----------------------------------------------

export const openApiExtractor: Extractor = {
  name: "openapi",
  sourceType: "openapi",

  async extract(ctx: ExtractionContext): Promise<ExtractionResult> {
    const diagnostics: DiagnosticEntry[] = [];
    const specFiles = resolveSpecFiles(ctx, diagnostics);

    if (specFiles.length === 0) {
      diagnostics.push({
        level: "info",
        stage: EXTRACTION_STAGE,
        sourceType: "openapi",
        message: `No OpenAPI spec found in ${ctx.projectPath}`,
      });
      return { extractor: "openapi", capabilities: [], diagnostics };
    }

    const allCapabilities: RawCapability[] = [];
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const specFile of specFiles) {
      processed += 1;
      try {
        const spec = loadSpec(specFile);
        const { capabilities: caps, supported } = extractFromSpec(spec, specFile, diagnostics);
        if (supported) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        allCapabilities.push(...caps);
        diagnostics.push({
          level: "info",
          stage: EXTRACTION_STAGE,
          sourceType: "openapi",
          message: `Extracted ${caps.length} capabilities from ${specFile}`,
          filePath: specFile,
          details: { count: caps.length },
        });
      } catch (err) {
        failed += 1;
        diagnostics.push({
          level: "error",
          stage: EXTRACTION_STAGE,
          sourceType: "openapi",
          message: `Failed to parse ${specFile}: ${err instanceof Error ? err.message : String(err)}`,
          filePath: specFile,
          details: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    diagnostics.push({
      level: failed > 0 ? "warning" : "info",
      stage: EXTRACTION_STAGE,
      sourceType: "openapi",
      message: `OpenAPI extractor summary — processed: ${processed}, succeeded: ${succeeded}, failed: ${failed}`,
      details: { processed, succeeded, failed },
    });

    return { extractor: "openapi", capabilities: allCapabilities, diagnostics };
  },
};
