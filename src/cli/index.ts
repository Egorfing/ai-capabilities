#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CLI entry point — dispatches to sub-commands
// ---------------------------------------------------------------------------

import { parseArgs } from "./parse-args.js";
import { runExtract } from "./commands/extract.js";
import { runEnrich } from "./commands/enrich.js";
import { runServe } from "./commands/serve.js";
import { runValidate } from "./commands/validate.js";
import { runTrace } from "./commands/trace.js";
import { runPilotCommand } from "./commands/pilot.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runInitCommand } from "./commands/init.js";
import { runPromptCommand } from "./commands/prompt.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runScaffoldCommand } from "./commands/scaffold.js";
import { runDetectLlmCommand } from "./commands/detect-llm.js";
import { runAutoBindCommand } from "./commands/auto-bind.js";
import { runQuickScanCommand } from "./commands/quick-scan.js";

const MAIN_HELP = `
capability-engine — AI Capability Extraction + Agent Runtime

Usage: capability-engine <command> [options]

Commands:
  extract       Extract capabilities from a project
  enrich        Enrich raw capabilities with LLM
  serve         Start HTTP server
  pilot         Run pilot extraction/enrichment and reports
  inspect       Inspect canonical manifest summary
  validate      Validate a capability manifest
  trace list    List execution traces
  init          Scaffold config + capability registry
  prompt        Generate LLM prompt templates for capability completion
  doctor        Diagnose project readiness and missing steps
  scaffold      Generate defineCapabilityFromExtracted scaffolds
  auto-bind     Auto-generate safe capability files from extracted manifest
  detect-llm    Detect existing AI/LLM stacks in the project

Options:
  --help        Show help for a command

Examples:
  capability-engine extract --project ./my-app
  capability-engine enrich --input ./output/capabilities.raw.json
  capability-engine validate --file ./output/capabilities.raw.json
  capability-engine serve --port 3000
  capability-engine pilot -- --project ../my-app --with-enrich
  capability-engine trace list --limit 10
  capability-engine inspect --project ./my-app --public
  capability-engine init
`.trim();

const parsed = parseArgs(process.argv);

async function main() {
  switch (parsed.command) {
    case "extract":
      await runExtract(parsed);
      break;
    case "enrich":
      await runEnrich(parsed);
      break;
    case "serve":
      await runServe(parsed);
      break;
    case "pilot":
      await runPilotCommand(parsed);
      break;
    case "inspect":
      await runInspectCommand(parsed);
      break;
    case "validate":
      runValidate(parsed);
      break;
    case "trace list":
      await runTrace(parsed);
      break;
    case "init":
      await runInitCommand(parsed);
      break;
    case "prompt":
      await runPromptCommand(parsed);
      break;
    case "scaffold":
      await runScaffoldCommand(parsed);
      break;
    case "auto-bind":
      await runAutoBindCommand(parsed);
      break;
    case "detect-llm":
      await runDetectLlmCommand(parsed);
      break;
    case "doctor":
      await runDoctorCommand(parsed);
      break;
    case "help":
      console.log(MAIN_HELP);
      break;
    case "":
      if (parsed.flags.help) {
        console.log(MAIN_HELP);
        break;
      }
      await runQuickScanCommand(parsed);
      break;
    default:
      if (parsed.flags.help) {
        console.error(MAIN_HELP);
      } else {
        console.error(`Unknown command: "${parsed.command}"\n`);
        console.error(MAIN_HELP);
      }
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
