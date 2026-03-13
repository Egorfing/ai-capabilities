import type { ParsedArgs } from "../parse-args.js";
import { runDoctor } from "../../doctor/index.js";
import { formatDoctorReport, formatDoctorReportJson } from "../../doctor/doctor-printer.js";

export const doctorHelp = `
Usage: ai-capabilities doctor [options]

Diagnose project readiness without mutating files.

Options:
  --project <path>   Override project root
  --config <path>    Path to ai-capabilities.config.json|ts
  --json             Output JSON
  --help             Show this help
`.trim();

export async function runDoctorCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(doctorHelp);
    return;
  }

  const report = await runDoctor({
    cwd: process.cwd(),
    projectPath: typeof args.flags.project === "string" ? args.flags.project : undefined,
    configPath: typeof args.flags.config === "string" ? args.flags.config : undefined,
  });

  if (isJson(args.flags.json)) {
    console.log(formatDoctorReportJson(report));
    return;
  }

  console.log(formatDoctorReport(report));
}

function isJson(value: unknown): boolean {
  if (typeof value === "string") {
    return value === "" || value.toLowerCase() === "true";
  }
  return Boolean(value);
}
