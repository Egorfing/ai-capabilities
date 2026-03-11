import { resolve } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { loadConfig } from "../../config/load-config.js";
import { runEnrichment } from "../../enrich/index.js";
import { logDiagnostics, summarizeDiagnostics } from "../../utils/diagnostics.js";
import { createTraceWriter } from "../../trace/index.js";

export const enrichHelp = `
Usage: capability-engine enrich [options]

Enrich raw capabilities with LLM-generated metadata.

Options:
  --input <path>    Path to ai-capabilities.json (default: config.output.canonical)
  --output <path>   Output file (default: config.output.enriched)
  --model <name>    Model provider (mock, internal). Default: mock
  --config <path>   Path to ai-capabilities.config.json|ts
  --help            Show this help
`.trim();

export async function runEnrich(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(enrichHelp);
    return;
  }

  const config = await loadConfig({
    configPath: typeof args.flags.config === "string" ? args.flags.config : undefined,
    cwd: process.cwd(),
  });

  const input =
    typeof args.flags.input === "string"
      ? resolve(args.flags.input)
      : config.output.canonical;
  const output =
    typeof args.flags.output === "string"
      ? resolve(args.flags.output)
      : config.output.enriched;
  const model = typeof args.flags.model === "string" ? args.flags.model : "mock";

  const { writer: traceWriter, traceId } = createTraceWriter({
    tracesDir: config.output.tracesDir,
  });

  console.log(`[enrich] config: ${config.filePath}`);
  console.log(`[enrich] model: ${model}`);
  console.log(`[enrich] trace: ${traceId}`);
  console.log(`[enrich] input: ${input}`);
  console.log(`[enrich] output: ${output}`);

  const { diagnostics } = await runEnrichment({
    inputPath: input,
    outputPath: output,
    model,
    traceWriter,
    traceId,
  });

  logDiagnostics(diagnostics, { minLevel: "warning" });
  const summary = summarizeDiagnostics(diagnostics);
  console.log(
    `[enrich] completed (${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} info)`,
  );
}
