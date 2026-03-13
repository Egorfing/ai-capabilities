import type { DoctorReport } from "./doctor-types.js";

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`Status: ${humanizeStatus(report.status)}`);
  if (report.projectPath) lines.push(`Project: ${report.projectPath}`);
  if (report.configPath) lines.push(`Config: ${report.configOk ? "OK" : "Missing"} (${report.configPath})`);
  if (report.configError && !report.configOk) {
    lines.push(`Config error: ${report.configError}`);
  }

  lines.push("\nOutputs:");
  for (const key of ["raw", "canonical", "public", "enriched", "diagnostics", "tracesDir"] as const) {
    const check = report.outputChecks[key];
    if (!check) continue;
    const status = check.exists ? "present" : "missing";
    lines.push(`- ${labelForOutputKey(key)}: ${status} (${check.path})`);
  }

  if (report.capabilityStats) {
    const stats = report.capabilityStats;
    lines.push("\nCapabilities:");
    lines.push(
      `- Total: ${stats.total} • Public: ${stats.publicCount} • Executable: ${stats.executable} • Unbound: ${stats.unbound}`,
    );
    lines.push(`- Requires confirmation: ${stats.confirmationRequired} • High risk: ${stats.highRisk}`);
  }

  if (report.scaffold) {
    lines.push("\nLocal scaffold:");
    lines.push(
      `- Directory: ${report.scaffold.directory} (${report.scaffold.present ? "present" : "missing"})`,
    );
    lines.push(
      `- Registry.ts: ${report.scaffold.registryExists ? "present" : "missing"}, capabilities/: ${report.scaffold.capabilitiesDirExists ? "present" : "missing"}`,
    );
  }

  if (report.safetyWarnings.length) {
    lines.push("\nSafety warnings:");
    report.safetyWarnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  if (report.issues.length) {
    lines.push("\nIssues:");
    report.issues.forEach((issue) => lines.push(`- [${issue.severity}] ${issue.message}`));
  }

  if (report.nextSteps.length) {
    lines.push("\nRecommended next steps:");
    report.nextSteps.forEach((step, idx) => lines.push(`  ${idx + 1}. ${step}`));
  }

  lines.push(
    "\nIntegration maturity: " + statusCode(report.status),
    "Scale: NOT_INITIALIZED < INITIALIZED < EXTRACTED < DISCOVERABLE < PARTIALLY_EXECUTABLE < PILOT_READY",
  );

  return lines.join("\n").trim();
}

export function formatDoctorReportJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}

function labelForOutputKey(key: keyof DoctorReport["outputChecks"]): string {
  switch (key) {
    case "raw":
      return "Raw manifest";
    case "canonical":
      return "Canonical manifest";
    case "public":
      return "Public manifest";
    case "enriched":
      return "Enriched manifest";
    case "diagnostics":
      return "Diagnostics";
    case "tracesDir":
      return "Traces";
    default:
      return String(key);
  }
}

function humanizeStatus(status: string): string {
  switch (status) {
    case "not_initialized":
      return "Not initialized";
    case "initialized":
      return "Initialized (config only)";
    case "extracted":
      return "Extracted (no capabilities)";
    case "discoverable":
      return "Discoverable (unbound)";
    case "partially_executable":
      return "Partially executable";
    case "pilot_ready":
      return "Pilot ready";
    default:
      return status;
  }
}

function statusCode(status: string): string {
  return status.toUpperCase();
}
