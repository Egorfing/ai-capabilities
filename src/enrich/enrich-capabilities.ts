import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  AiCapabilitiesManifest,
  AiCapability,
  DiagnosticEntry,
} from "../types/index.js";
import { buildEnrichmentPrompt } from "./prompt-template.js";
import type { ModelClient } from "./model-client.js";
import { createModelClient } from "./model-client.js";
import type {
  CapabilityEnrichment,
  EnrichedAiCapability,
  EnrichedAiCapabilitiesManifest,
} from "./enrich-types.js";
import { isConfirmationPolicy, isRiskLevel } from "./enrich-types.js";
import type { TraceWriter } from "../trace/index.js";
import { enrichmentEvent } from "../trace/index.js";

export interface RunEnrichmentOptions {
  inputPath: string;
  outputPath: string;
  model: string;
  /** Optional trace writer for observability. */
  traceWriter?: TraceWriter;
  /** Trace ID for this enrichment run. */
  traceId?: string;
}

export interface EnrichResult {
  manifest: EnrichedAiCapabilitiesManifest;
  diagnostics: DiagnosticEntry[];
}

export async function runEnrichment(options: RunEnrichmentOptions): Promise<EnrichResult> {
  const canonical = readManifest(options.inputPath);
  const client = createModelClient(options.model);
  const result = await enrichManifest(canonical, client, {
    traceWriter: options.traceWriter,
    traceId: options.traceId,
  });
  writeManifest(options.outputPath, result.manifest);
  return result;
}

export interface EnrichManifestOptions {
  traceWriter?: TraceWriter;
  traceId?: string;
}

export async function enrichManifest(
  manifest: AiCapabilitiesManifest,
  client: ModelClient,
  opts?: EnrichManifestOptions,
): Promise<EnrichResult> {
  const tw = opts?.traceWriter;
  const traceId = opts?.traceId ?? "";
  const diagnostics: DiagnosticEntry[] = [];
  const enrichedCapabilities: EnrichedAiCapability[] = [];

  if (tw && traceId) {
    await tw.write(enrichmentEvent(traceId, "enrichment.started", "Enrichment started", {
      data: { model: client.name, capabilityCount: manifest.capabilities.length },
    }));
  }

  for (const capability of manifest.capabilities) {
    if (tw && traceId) {
      await tw.write(enrichmentEvent(traceId, "capability.enrichment.started", `Enriching "${capability.id}"`, {
        capabilityId: capability.id,
      }));
    }

    const prompt = buildEnrichmentPrompt(capability);
    try {
      const response = await client.generateEnrichment(prompt);
      if ("error" in response) {
        diagnostics.push(buildWarning(capability, response.error));
        enrichedCapabilities.push(cloneCapability(capability));

        if (tw && traceId) {
          await tw.write(enrichmentEvent(traceId, "capability.enrichment.warning", `Enrichment warning for "${capability.id}": ${response.error}`, {
            level: "warning",
            capabilityId: capability.id,
          }));
        }
        continue;
      }

      const normalized = normalizeEnrichment(response);
      if (!normalized.success) {
        diagnostics.push(buildWarning(capability, normalized.error));
        enrichedCapabilities.push(cloneCapability(capability));

        if (tw && traceId) {
          await tw.write(enrichmentEvent(traceId, "capability.enrichment.warning", `Normalization warning for "${capability.id}": ${normalized.error}`, {
            level: "warning",
            capabilityId: capability.id,
          }));
        }
        continue;
      }

      const merged = applyEnrichment(capability, normalized.value);
      enrichedCapabilities.push(merged);

      if (tw && traceId) {
        await tw.write(enrichmentEvent(traceId, "capability.enrichment.completed", `Enriched "${capability.id}"`, {
          capabilityId: capability.id,
        }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      diagnostics.push(buildWarning(capability, msg));
      enrichedCapabilities.push(cloneCapability(capability));

      if (tw && traceId) {
        await tw.write(enrichmentEvent(traceId, "capability.enrichment.error", `Enrichment error for "${capability.id}": ${msg}`, {
          level: "error",
          capabilityId: capability.id,
        }));
      }
    }
  }

  const enrichedManifest: EnrichedAiCapabilitiesManifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    capabilities: enrichedCapabilities,
  };

  if (tw && traceId) {
    await tw.write(enrichmentEvent(traceId, "enrichment.completed", "Enrichment completed", {
      data: {
        enrichedCount: enrichedCapabilities.length,
        diagnosticsCount: diagnostics.length,
      },
    }));
  }

  return { manifest: enrichedManifest, diagnostics };
}

function readManifest(path: string): AiCapabilitiesManifest {
  const raw = readFileSync(path, "utf-8");
  const manifest = JSON.parse(raw) as AiCapabilitiesManifest;
  if (!manifest || !Array.isArray(manifest.capabilities)) {
    throw new Error(`Manifest at ${path} is invalid or missing capabilities array`);
  }
  return manifest;
}

function writeManifest(path: string, manifest: EnrichedAiCapabilitiesManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}

function applyEnrichment(
  capability: AiCapability,
  enrichment: CapabilityEnrichment,
): EnrichedAiCapability {
  const next = cloneCapability(capability);

  if (!next.displayTitle && enrichment.displayTitle) {
    next.displayTitle = enrichment.displayTitle;
  }
  if (!next.userDescription && enrichment.userDescription) {
    next.userDescription = enrichment.userDescription;
  }
  if ((!next.aliases || next.aliases.length === 0) && enrichment.aliases?.length) {
    next.aliases = enrichment.aliases;
  }
  if (
    (!next.exampleIntents || next.exampleIntents.length === 0) &&
    enrichment.exampleIntents?.length
  ) {
    next.exampleIntents = enrichment.exampleIntents;
  }

  return next;
}

function cloneCapability(capability: AiCapability): EnrichedAiCapability {
  return {
    ...capability,
    tags: capability.tags ? [...capability.tags] : undefined,
    aliases: capability.aliases ? [...capability.aliases] : undefined,
    exampleIntents: capability.exampleIntents ? [...capability.exampleIntents] : undefined,
    sources: capability.sources.map((source) => ({ ...source })),
    effects: capability.effects ? capability.effects.map((effect) => ({ ...effect })) : undefined,
    navigation: capability.navigation ? { ...capability.navigation } : undefined,
    execution: capability.execution
      ? {
          ...capability.execution,
          endpoint: capability.execution.endpoint
            ? {
                ...capability.execution.endpoint,
                headers: capability.execution.endpoint.headers
                  ? { ...capability.execution.endpoint.headers }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
    policy: {
      ...capability.policy,
      permissionScope: capability.policy.permissionScope
        ? [...capability.policy.permissionScope]
        : undefined,
    },
    diagnostics: capability.diagnostics
      ? capability.diagnostics.map((diag) => ({ ...diag }))
      : undefined,
  };
}

function normalizeEnrichment(
  payload: CapabilityEnrichment,
): { success: true; value: CapabilityEnrichment } | { success: false; error: string } {
  const normalized: CapabilityEnrichment = {};

  if (payload.displayTitle !== undefined) {
    if (typeof payload.displayTitle !== "string" || !payload.displayTitle.trim()) {
      return { success: false, error: "displayTitle must be a non-empty string" };
    }
    normalized.displayTitle = payload.displayTitle.trim();
  }

  if (payload.userDescription !== undefined) {
    if (typeof payload.userDescription !== "string" || !payload.userDescription.trim()) {
      return { success: false, error: "userDescription must be a non-empty string" };
    }
    normalized.userDescription = payload.userDescription.trim();
  }

  if (payload.aliases !== undefined) {
    if (!Array.isArray(payload.aliases)) {
      return { success: false, error: "aliases must be an array of strings" };
    }
    const aliases = dedupeStrings(payload.aliases);
    if (aliases.length === 0 && payload.aliases.length > 0) {
      return { success: false, error: "aliases must contain at least one non-empty string" };
    }
    if (aliases.length > 0) {
      normalized.aliases = aliases;
    }
  }

  if (payload.exampleIntents !== undefined) {
    if (!Array.isArray(payload.exampleIntents)) {
      return { success: false, error: "exampleIntents must be an array of strings" };
    }
    const intents = dedupeStrings(payload.exampleIntents);
    if (intents.length === 0 && payload.exampleIntents.length > 0) {
      return { success: false, error: "exampleIntents must contain strings" };
    }
    if (intents.length > 0) {
      normalized.exampleIntents = intents;
    }
  }

  if (payload.riskLevel !== undefined) {
    if (!isRiskLevel(payload.riskLevel)) {
      return { success: false, error: "riskLevel has an invalid value" };
    }
    normalized.riskLevel = payload.riskLevel;
  }

  if (payload.confirmationPolicy !== undefined) {
    if (!isConfirmationPolicy(payload.confirmationPolicy)) {
      return { success: false, error: "confirmationPolicy has an invalid value" };
    }
    normalized.confirmationPolicy = payload.confirmationPolicy;
  }

  return { success: true, value: normalized };
}

function dedupeStrings(values: string[]): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) deduped.add(trimmed);
    }
  }
  return Array.from(deduped);
}

function buildWarning(capability: AiCapability, message: string): DiagnosticEntry {
  return {
    level: "warning",
    stage: "enrichment",
    capabilityId: capability.id,
    sourceType: capability.sources?.[0]?.type ?? "custom",
    message,
  };
}
