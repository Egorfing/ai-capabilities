import { resolve } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { analyzeCapabilityStatus } from "../../status/capability-status.js";

export const statusHelp = `
Usage: ai-capabilities status [options]

Show lifecycle status (discovered → executable) for each capability.

Options:
  --project <path>   Project root (default: cwd)
  --manifest <path>  Path to canonical manifest (default: ./output/ai-capabilities.json)
  --help             Show this help
`.trim();

export async function runStatusCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(statusHelp);
    return;
  }

  const projectPath = typeof args.flags.project === "string" ? resolve(args.flags.project) : process.cwd();
  const manifestPath = typeof args.flags.manifest === "string" ? args.flags.manifest : undefined;

  const report = analyzeCapabilityStatus({ cwd: projectPath, manifestPath });

  printSummary(report);
  printRows(report);
}

function printSummary(report: ReturnType<typeof analyzeCapabilityStatus>): void {
  console.log("Capability lifecycle summary");
  console.log("----------------------------");
  console.log(`Discovered : ${report.summary.discovered}`);
  console.log(`Scaffolded : ${report.summary.scaffolded}`);
  console.log(`Authored   : ${report.summary.authored}`);
  console.log(`Registered : ${report.summary.registered}`);
  console.log(`Runtime    : ${report.runtimeDetected ? "detected" : "not detected"}`);
  console.log(`Executable : ${report.summary.executable}`);
  console.log("");
}

function printRows(report: ReturnType<typeof analyzeCapabilityStatus>): void {
  console.log("Capability status (yes / no / unknown)");
  console.log("ID                               Disc  Scaf  Auth  Reg   Wired Exec  Notes");
  for (const row of report.rows) {
    const notes = row.notes.length ? row.notes.join("; ") : "-";
    console.log(
      `${pad(row.id, 32)}  ${pad(row.discovered, 4)}  ${pad(row.scaffolded, 4)}  ${pad(row.authored, 4)}  ${pad(row.registered, 4)}  ${pad(row.wired, 4)}  ${pad(row.executable, 4)}  ${notes}`,
    );
  }
}

function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}
