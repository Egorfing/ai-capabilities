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

export interface ExtractCommandOptions {
  projectPath?: string;
  outputPath?: string;
  configPath?: string;
  cwd?: string;
  logger?: (message: string) => void;
}

export interface ExtractCommandResult {
  projectPath: string;
  configPath: string;
  rawPath: string;
  canonicalPath: string;
  publicPath: string;
  diagnosticsPath: string;
  capabilityCount: number;
  canonicalCount: number;
  extractors: string[];
}

export async function runExtract(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(extractHelp);
    return;
  }

  await executeExtractCommand({
    projectPath: typeof args.flags.project === "string" ? args.flags.project : undefined,
    outputPath: typeof args.flags.output === "string" ? args.flags.output : undefined,
    configPath: typeof args.flags.config === "string" ? args.flags.config : undefined,
    cwd: process.cwd(),
    logger: (message) => console.log(message),
  });
}

export async function executeExtractCommand(options: ExtractCommandOptions = {}): Promise<ExtractCommandResult> {
  const cwd = options.cwd ?? process.cwd();
  const logger = options.logger ?? (() => {});

  const config = await loadConfig({
    configPath: options.configPath,
    cwd,
  });

  const projectPath = options.projectPath ? resolve(cwd, options.projectPath) : config.project.root;
  const outputPath = options.outputPath ? resolve(cwd, options.outputPath) : config.output.raw;

  const finalConfig: ResolvedConfig = {
    ...config,
    project: { ...config.project, root: projectPath },
    output: { ...config.output, raw: outputPath },
  };

  const { writer: traceWriter, traceId } = createTraceWriter({
    tracesDir: finalConfig.output.tracesDir,
  });

  logger(`[extract] config: ${config.filePath}`);
  logger(`[extract] project: ${projectPath}`);
  logger(`[extract] trace: ${traceId}`);
  logger(`[extract] registered extractors: ${defaultRegistry.names().join(", ") || "(none)"}`);

  const result = await runPipeline(defaultRegistry, { projectPath, config: finalConfig }, {
    traceWriter,
    traceId,
  });

  logDiagnostics(result.diagnostics, { minLevel: "warning" });
  const mergeResult = mergeCapabilities(result.capabilities);

  const manifest: RawCapabilityManifest = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceProject: projectPath,
      extractors: result.extractorsRun,
      version: "0.2.1",
    },
    capabilities: mergeResult.capabilities,
  };

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

  logger(
    `[extract] merged ${result.capabilities.length} technical capabilities into ${mergeResult.capabilities.length} canonical capabilities`,
  );
  logger(`[extract] ${mergeResult.capabilities.length} capabilities written`);
  logger(`[extract] raw manifest written to ${absOutput}`);
  logger(`[extract] canonical manifest written to ${canonicalPath}`);
  logger(`[extract] public manifest written to ${publicPath}`);
  logger(
    `[extract] diagnostics saved to ${diagnosticsPath} (${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} info)`,
  );

  return {
    projectPath,
    configPath: config.filePath,
    rawPath: absOutput,
    canonicalPath,
    publicPath,
    diagnosticsPath,
    capabilityCount: result.capabilities.length,
    canonicalCount: mergeResult.capabilities.length,
    extractors: result.extractorsRun,
  };
}
