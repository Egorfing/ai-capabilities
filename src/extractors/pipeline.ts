// ---------------------------------------------------------------------------
// Extraction pipeline: run extractors, merge results
// ---------------------------------------------------------------------------

import type {
  Extractor,
  ExtractionContext,
  ExtractionResult,
  PipelineResult,
} from "./types.js";
import { EXTRACTION_STAGE } from "./types.js";
import type { RawCapability, DiagnosticEntry } from "../types/index.js";
import type { ExtractorRegistry } from "./registry.js";
import { normalizeCapabilitySchemas } from "../normalize/schema-normalizer.js";
import type { TraceWriter } from "../trace/index.js";
import { extractionEvent } from "../trace/index.js";

export interface PipelineOptions {
  /** If set, run only extractors whose sourceType is in this list. */
  only?: ExtractionContext["only"];
  /** Optional trace writer for observability. */
  traceWriter?: TraceWriter;
  /** Trace ID for this pipeline run. */
  traceId?: string;
}

/**
 * Run all registered extractors against a project and merge results.
 *
 * - Extractors run sequentially (predictable ordering, simpler debugging).
 * - A failing extractor does not stop the pipeline — it adds an error diagnostic.
 * - Merge is a simple concat; deduplication happens in later stages.
 */
export async function runPipeline(
  registry: ExtractorRegistry,
  ctx: ExtractionContext,
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const tw = opts.traceWriter;
  const traceId = opts.traceId ?? "";
  const allExtractors = registry.getAll();

  // Filter by source type if requested
  const extractors: Extractor[] = opts.only
    ? allExtractors.filter((e) => opts.only!.includes(e.sourceType))
    : allExtractors;

  if (tw && traceId) {
    await tw.write(extractionEvent(traceId, "extraction.started", "Extraction pipeline started", {
      data: {
        extractorCount: extractors.length,
        extractorNames: extractors.map((e) => e.name),
        projectPath: ctx.projectPath,
      },
    }));
  }

  const capabilities: RawCapability[] = [];
  const diagnostics: DiagnosticEntry[] = [];
  const extractorsRun: string[] = [];

  for (const extractor of extractors) {
    if (tw && traceId) {
      await tw.write(extractionEvent(traceId, "extractor.started", `Extractor "${extractor.name}" started`, {
        data: { extractor: extractor.name, sourceType: extractor.sourceType },
      }));
    }

    try {
      const result: ExtractionResult = await extractor.extract(ctx);
      capabilities.push(...result.capabilities);
      diagnostics.push(...result.diagnostics);
      extractorsRun.push(extractor.name);

      if (tw && traceId) {
        await tw.write(extractionEvent(traceId, "extractor.completed", `Extractor "${extractor.name}" completed`, {
          data: {
            extractor: extractor.name,
            capabilitiesFound: result.capabilities.length,
            diagnosticsCount: result.diagnostics.length,
          },
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diagnostics.push({
        level: "error",
        stage: EXTRACTION_STAGE,
        sourceType: extractor.sourceType,
        message,
        details: err instanceof Error ? err.stack : undefined,
      });
      extractorsRun.push(extractor.name);

      if (tw && traceId) {
        await tw.write(extractionEvent(traceId, "extractor.error", `Extractor "${extractor.name}" failed: ${message}`, {
          level: "error",
          data: { extractor: extractor.name, error: message },
        }));
      }
    }
  }

  if (extractors.length === 0) {
    diagnostics.push({
      level: "warning",
      stage: EXTRACTION_STAGE,
      message: "No extractors registered or matched the filter.",
    });
  }

  await normalizeCapabilitySchemas(capabilities, ctx.config.schema, diagnostics);

  if (tw && traceId) {
    await tw.write(extractionEvent(traceId, "extraction.completed", "Extraction pipeline completed", {
      data: {
        totalCapabilities: capabilities.length,
        extractorsRun,
        diagnosticsCount: diagnostics.length,
      },
    }));
  }

  return { capabilities, diagnostics, extractorsRun };
}
