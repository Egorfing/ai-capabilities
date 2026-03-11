import { resolve, dirname } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import type { ParsedArgs } from "../parse-args.js";
import { defaultRegistry, runPipeline } from "../../extractors/index.js";
import type { RawCapabilityManifest } from "../../types/index.js";
import { loadConfig } from "../../config/load-config.js";
import type { ResolvedConfig } from "../../config/types.js";
import {
  logDiagnostics,
  summarizeDiagnostics,
  writeDiagnosticsFile,
} from "../../utils/diagnostics.js";
import { mergeCapabilities } from "../../merge/merge-capabilities.js";
import { buildAiCapabilitiesManifest } from "../../manifest/build-manifest.js";
import { createTraceWriter } from "../../trace/index.js";

export const extractHelp = `
Usage: capability-engine extract [options]

Extract capabilities from a project source code.

Options:
  --project <path>   Override project root from config
  --output <path>    Override output file for raw manifest
  --config <path>    Path to ai-capabilities.config.json|ts (default: auto-discover)
  --help             Show this help
`.trim();

export async function runExtract(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(extractHelp);
    return;
  }

  const projectFlag = args.flags.project;
  const outputFlag = args.flags.output;
  const configFlag = args.flags.config;

  const config = await loadConfig({
    configPath: typeof configFlag === "string" ? configFlag : undefined,
    cwd: process.cwd(),
  });

  const projectPath =
    projectFlag && typeof projectFlag === "string"
      ? resolve(projectFlag)
      : config.project.root;
  const outputPath =
    outputFlag && typeof outputFlag === "string"
      ? resolve(outputFlag)
      : config.output.raw;

  const finalConfig: ResolvedConfig = {
    ...config,
    project: { ...config.project, root: projectPath },
    output: { ...config.output, raw: outputPath },
  };

  const { writer: traceWriter, traceId } = createTraceWriter({
    tracesDir: finalConfig.output.tracesDir,
  });

  console.log(`[extract] config: ${config.filePath}`);
  console.log(`[extract] project: ${projectPath}`);
  console.log(`[extract] trace: ${traceId}`);
  console.log(`[extract] registered extractors: ${defaultRegistry.names().join(", ") || "(none)"}`);

  const result = await runPipeline(defaultRegistry, { projectPath, config: finalConfig }, {
    traceWriter,
    traceId,
  });

  logDiagnostics(result.diagnostics, { minLevel: "warning" });
  const mergeResult = mergeCapabilities(result.capabilities);

  // Build manifest
  const manifest: RawCapabilityManifest = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceProject: projectPath,
      extractors: result.extractorsRun,
      version: "0.1.0",
    },
    capabilities: mergeResult.capabilities,
  };

  // Write output
  const absOutput = finalConfig.output.raw;
  mkdirSync(dirname(absOutput), { recursive: true });
  writeFileSync(absOutput, JSON.stringify(manifest, null, 2) + "\n");

  const { canonical, publicManifest } = buildAiCapabilitiesManifest({
    capabilities: mergeResult.capabilities,
    config: finalConfig,
  });

  const canonicalPath = finalConfig.output.canonical;
  mkdirSync(dirname(canonicalPath), { recursive: true });
  writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + "\n");

  const publicPath = finalConfig.output.public;
  mkdirSync(dirname(publicPath), { recursive: true });
  writeFileSync(publicPath, JSON.stringify(publicManifest, null, 2) + "\n");

  const diagnosticsPath = finalConfig.output.diagnostics;
  writeDiagnosticsFile(result.diagnostics, diagnosticsPath);
  const summary = summarizeDiagnostics(result.diagnostics);

  console.log(
    `[extract] merged ${result.capabilities.length} technical capabilities into ${mergeResult.capabilities.length} canonical capabilities`,
  );
  console.log(`[extract] ${mergeResult.capabilities.length} capabilities written`);
  console.log(`[extract] raw manifest written to ${absOutput}`);
  console.log(`[extract] canonical manifest written to ${canonicalPath}`);
  console.log(`[extract] public manifest written to ${publicPath}`);
  console.log(
    `[extract] diagnostics saved to ${diagnosticsPath} (${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} info)`,
  );
}
