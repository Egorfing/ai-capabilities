import { resolve } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { runPilot } from "../../pilot/index.js";

export const pilotHelp = `
Usage: capability-engine pilot [options]

Run the extraction/enrichment pipeline against a real project and collect reports.

Options:
  --project <path>     Path to the target project (overrides config)
  --config <path>      Path to ai-capabilities.config.json|ts
  --report-dir <path>  Directory for pilot-report.json and pilot-summary.md
  --with-enrich        Run enrichment after manifest build
  --help               Show this help
`.trim();

export async function runPilotCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(pilotHelp);
    return;
  }

  const projectPath = typeof args.flags.project === "string" ? resolve(args.flags.project) : undefined;
  const configPath = typeof args.flags.config === "string" ? resolve(args.flags.config) : undefined;
  const reportDir = typeof args.flags["report-dir"] === "string" ? resolve(args.flags["report-dir"]) : undefined;
  const withEnrich = Boolean(args.flags["with-enrich"]);

  const result = await runPilot({
    projectPath,
    configPath,
    reportDir,
    withEnrich,
  });

  console.log(`[pilot] status: ${result.report.status}`);
  console.log(`[pilot] report: ${result.reportPath}`);
  console.log(`[pilot] summary: ${result.summaryPath}`);

  if (result.report.status === "failed") {
    process.exitCode = 1;
  }
}
