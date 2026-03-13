import { relative } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { initProject } from "../../init/index.js";

export const initHelp = `
Usage: ai-capabilities init

Bootstrap ai-capabilities.config.json and src/ai-capabilities scaffold.

Options:
  --help        Show this help message
`.trim();

export async function runInitCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(initHelp);
    return;
  }

  const result = await initProject({ cwd: process.cwd() });
  const cwd = process.cwd();
  console.log(`[init] Project: ${result.projectName}`);

  for (const report of [result.config, ...result.scaffold]) {
    const relPath = relative(cwd, report.path) || ".";
    const status = report.status === "created" ? "created" : "skipped";
    const suffix = report.reason ? ` (${report.reason})` : "";
    console.log(`[init] ${status.padEnd(7)} ${relPath}${suffix}`);
  }

  console.log("\nNext steps:");
  result.nextSteps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step}`);
  });
}
