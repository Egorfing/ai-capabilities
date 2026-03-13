import { resolve, dirname } from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { loadConfig } from "../config/load-config.js";
import type { ResolvedConfig } from "../config/types.js";
import { runPipeline, defaultRegistry } from "../extractors/index.js";
import { mergeCapabilities } from "../merge/merge-capabilities.js";
import { buildAiCapabilitiesManifest } from "../manifest/build-manifest.js";
import { summarizeDiagnostics, writeDiagnosticsFile } from "../utils/diagnostics.js";
import type { DiagnosticSummary } from "../utils/diagnostics.js";
import { runEnrichment } from "../enrich/index.js";
import { createTraceWriter, runtimeEvent } from "../trace/index.js";
import type { TraceWriter } from "../trace/trace-types.js";
import type {
  RawCapability,
  DiagnosticEntry,
  RawCapabilityManifest,
  AiCapabilitiesManifest,
} from "../types/index.js";
import { runCompatibilityChecks } from "./compatibility-checks.js";
import { collectUnsupportedPatterns, writePilotReport, toReportPath } from "./pilot-report.js";
import { buildPilotSummaryMarkdown } from "./pilot-summary.js";
import type {
  PilotArtifacts,
  PilotOptions,
  PilotReport,
  PilotRunResult,
  PilotStatus,
  PilotExtractorReport,
} from "./pilot-types.js";

export async function runPilot(options: PilotOptions = {}): Promise<PilotRunResult> {
  const startedAt = new Date();
  let finishedAt = startedAt;
  const cwd = options.cwd ?? process.cwd();
  let config: ResolvedConfig | undefined;
  let finalConfig: ResolvedConfig | undefined;
  let projectPath = options.projectPath ? resolve(options.projectPath) : "";
  const diagnostics: DiagnosticEntry[] = [];
  const notes: string[] = [];
  let traceId = "";
  let traceWriter: TraceWriter | undefined;
  let canonicalManifest: AiCapabilitiesManifest | undefined;
  let publicManifest: AiCapabilitiesManifest | undefined;
  let rawManifestPath: string | undefined;
  let canonicalManifestPath: string | undefined;
  let publicManifestPath: string | undefined;
  let enrichedManifestPath: string | undefined;
  let diagnosticsPath: string | undefined;
  let tracesDir: string | undefined;
  let reportDir = options.reportDir ? resolve(options.reportDir) : undefined;
  let pipelineCapabilities: RawCapability[] = [];
  let extractorsRun: string[] = [];
  let enriched = false;
  const fatalErrors: string[] = [];
  let compatibility = { errors: [] as string[], warnings: [] as string[] };

  try {
    config = await loadConfig({
      configPath: options.configPath,
      cwd,
    });
    projectPath = options.projectPath ? resolve(options.projectPath) : config.project.root;
    finalConfig = {
      ...config,
      project: {
        ...config.project,
        root: projectPath,
      },
    };
    diagnosticsPath = finalConfig.output.diagnostics;
    tracesDir = finalConfig.output.tracesDir;
    if (!reportDir) {
      reportDir = dirname(finalConfig.output.canonical);
    }
  } catch (err) {
    fatalErrors.push(`Failed to load config: ${formatError(err)}`);
  }

  if (!reportDir) {
    reportDir = resolve(cwd, "output");
  }

  const reportPath = resolve(reportDir, "pilot-report.json");
  const summaryPath = resolve(reportDir, "pilot-summary.md");

  if (finalConfig) {
    const traceSetup = createTraceWriter({ tracesDir: finalConfig.output.tracesDir });
    traceWriter = traceSetup.writer;
    traceId = traceSetup.traceId;
    await traceWriter.write(
      runtimeEvent(traceId, "pilot.started", "Pilot run started", {
        data: { projectPath },
      }),
    );

    compatibility = runCompatibilityChecks(finalConfig, projectPath);
    if (compatibility.errors.length > 0) {
      fatalErrors.push("Compatibility checks failed. See report for details.");
    }
  }

  if (finalConfig && fatalErrors.length === 0) {
    try {
      const pipelineResult = await runPipeline(
        defaultRegistry,
        { projectPath, config: finalConfig },
        { traceWriter, traceId },
      );
      pipelineCapabilities = pipelineResult.capabilities;
      extractorsRun = pipelineResult.extractorsRun;
      diagnostics.push(...pipelineResult.diagnostics);

      const mergeResult = mergeCapabilities(pipelineResult.capabilities);
      const rawManifest: RawCapabilityManifest = {
        meta: {
          generatedAt: new Date().toISOString(),
          sourceProject: projectPath,
          extractors: pipelineResult.extractorsRun,
          version: "0.2.1",
        },
        capabilities: mergeResult.capabilities,
      };

      rawManifestPath = finalConfig.output.raw;
      canonicalManifestPath = finalConfig.output.canonical;
      publicManifestPath = finalConfig.output.public;
      mkdirSync(dirname(rawManifestPath), { recursive: true });
      writeFileSync(rawManifestPath, JSON.stringify(rawManifest, null, 2) + "\n");

      const { canonical, publicManifest: publicOnly } = buildAiCapabilitiesManifest({
        capabilities: mergeResult.capabilities,
        config: finalConfig,
      });
      canonicalManifest = canonical;
      publicManifest = publicOnly;

      mkdirSync(dirname(canonicalManifestPath), { recursive: true });
      writeFileSync(canonicalManifestPath, JSON.stringify(canonicalManifest, null, 2) + "\n");

      mkdirSync(dirname(publicManifestPath), { recursive: true });
      writeFileSync(publicManifestPath, JSON.stringify(publicManifest, null, 2) + "\n");

      if (diagnosticsPath) {
        writeDiagnosticsFile(diagnostics, diagnosticsPath);
      }

      if (options.withEnrich) {
        try {
          const model = options.model ?? "mock";
          const { diagnostics: enrichDiagnostics } = await runEnrichment({
            inputPath: canonicalManifestPath,
            outputPath: finalConfig.output.enriched,
            model,
            traceWriter,
            traceId,
          });
          diagnostics.push(...enrichDiagnostics);
          enrichedManifestPath = finalConfig.output.enriched;
          enriched = true;
        } catch (err) {
          notes.push(`Enrichment failed: ${formatError(err)}`);
        }
      }
    } catch (err) {
      fatalErrors.push(`Extraction failed: ${formatError(err)}`);
    }
  }

  finishedAt = new Date();

  const diagSummary = summarizeDiagnostics(diagnostics);
  const unsupportedPatterns = collectUnsupportedPatterns(diagnostics);
  const artifacts: PilotArtifacts = {
    rawManifest: fileIfExists(rawManifestPath),
    canonicalManifest: fileIfExists(canonicalManifestPath),
    publicManifest: fileIfExists(publicManifestPath),
    enrichedManifest: fileIfExists(enrichedManifestPath),
    diagnosticsLog: fileIfExists(diagnosticsPath),
    tracesDir: tracesDir ? toReportPath(tracesDir) : undefined,
    pilotReport: toReportPath(reportPath),
    pilotSummary: toReportPath(summaryPath),
  };

  const summary = {
    capabilitiesTotal: canonicalManifest?.capabilities.length ?? 0,
    publicCapabilities: publicManifest?.capabilities.length ?? 0,
    diagnostics: {
      info: diagSummary.infos,
      warning: diagSummary.warnings,
      error: diagSummary.errors,
    },
  };

  const extractorReports = buildExtractorReports(pipelineCapabilities, diagnostics, extractorsRun);

  const status = determineStatus({
    canonicalManifest,
    diagSummary,
    compatibility,
    fatalErrors,
    hasNotes: notes.length > 0,
    withEnrich: Boolean(options.withEnrich),
    enriched,
  });

  if (fatalErrors.length > 0) {
    notes.push(...fatalErrors);
  }

  const report: PilotReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    projectPath,
    configPath: config?.filePath ?? (options.configPath ? resolve(options.configPath) : "unknown"),
    traceId,
    status,
    summary,
    compatibility,
    extractors: extractorReports,
    artifacts,
    unsupportedPatterns,
    diagnosticsSummary: diagSummary,
    notes: notes.length > 0 ? notes : undefined,
  };

  writePilotReport(report, reportPath);
  writeSummaryFile(report, summaryPath);

  if (traceWriter && traceId) {
    await traceWriter.write(
      runtimeEvent(traceId, "pilot.completed", "Pilot run completed", {
        data: { status },
      }),
    );
  }

  return {
    report,
    reportPath,
    summaryPath,
  };
}

function determineStatus(args: {
  canonicalManifest?: AiCapabilitiesManifest;
  diagSummary: DiagnosticSummary;
  compatibility: { errors: string[]; warnings: string[] };
  fatalErrors: string[];
  hasNotes: boolean;
  withEnrich: boolean;
  enriched: boolean;
}): PilotStatus {
  if (!args.canonicalManifest || args.fatalErrors.length > 0) {
    return "failed";
  }
  if (args.compatibility.errors.length > 0 || args.diagSummary.errors > 0) {
    return "partial";
  }
  if (args.compatibility.warnings.length > 0 || args.diagSummary.warnings > 0) {
    return "partial";
  }
  if (args.withEnrich && !args.enriched) {
    return "partial";
  }
  return "success";
}

function buildExtractorReports(
  capabilities: RawCapability[],
  diagnostics: DiagnosticEntry[],
  extractorsRun: string[],
): PilotExtractorReport[] {
  const stats = new Map<string, { capabilities: number; warnings: number; errors: number }>();

  const ensure = (name: string) => {
    if (!stats.has(name)) {
      stats.set(name, { capabilities: 0, warnings: 0, errors: 0 });
    }
    return stats.get(name)!;
  };

  for (const name of extractorsRun) {
    ensure(name);
  }

  for (const cap of capabilities) {
    ensure(cap.source.type).capabilities += 1;
  }

  for (const diag of diagnostics) {
    if (!diag.sourceType) continue;
    const bucket = ensure(diag.sourceType);
    if (diag.level === "error") bucket.errors += 1;
    else if (diag.level === "warning") bucket.warnings += 1;
  }

  return Array.from(stats.entries())
    .map(([name, value]) => {
      const status: PilotStatus =
        value.errors > 0 ? "failed" : value.warnings > 0 ? "partial" : "success";
      return {
        name,
        capabilities: value.capabilities,
        warnings: value.warnings,
        errors: value.errors,
        status,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function fileIfExists(path?: string): string | undefined {
  if (!path) return undefined;
  return existsSync(path) ? toReportPath(path) : undefined;
}

function writeSummaryFile(report: PilotReport, targetPath: string): void {
  const markdown = buildPilotSummaryMarkdown(report);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, markdown.trimEnd() + "\n");
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
