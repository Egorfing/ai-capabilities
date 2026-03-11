import type { PilotReport } from "./pilot-types.js";

export function buildPilotSummaryMarkdown(report: PilotReport): string {
  const lines: string[] = [];
  lines.push("# Pilot Summary");
  lines.push("");
  lines.push(`- **Status:** ${report.status}`);
  lines.push(`- **Project:** ${report.projectPath}`);
  lines.push(`- **Config:** ${report.configPath}`);
  lines.push(`- **Started:** ${report.startedAt}`);
  lines.push(`- **Finished:** ${report.finishedAt}`);
  if (report.traceId) {
    lines.push(`- **Trace ID:** ${report.traceId}`);
  }
  lines.push("");
  lines.push("## Key Metrics");
  lines.push("");
  lines.push(`- Total capabilities: ${report.summary.capabilitiesTotal}`);
  lines.push(`- Public capabilities: ${report.summary.publicCapabilities}`);
  lines.push(
    `- Diagnostics — errors: ${report.summary.diagnostics.error}, warnings: ${report.summary.diagnostics.warning}, info: ${report.summary.diagnostics.info}`,
  );
  lines.push("");
  lines.push("## Extractors");
  lines.push("");
  if (report.extractors.length === 0) {
    lines.push("No extractors executed.");
  } else {
    lines.push("| Extractor | Status | Capabilities | Warnings | Errors |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const item of report.extractors) {
      lines.push(`| ${item.name} | ${item.status} | ${item.capabilities} | ${item.warnings} | ${item.errors} |`);
    }
  }
  lines.push("");
  lines.push("## Unsupported Patterns");
  lines.push("");
  if (report.unsupportedPatterns.length === 0) {
    lines.push("None detected.");
  } else {
    for (const pattern of report.unsupportedPatterns) {
      lines.push(`- ${pattern}`);
    }
  }
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  const entries = Object.entries(report.artifacts).filter(([, value]) => Boolean(value));
  if (entries.length === 0) {
    lines.push("No artifacts recorded.");
  } else {
    for (const [key, value] of entries) {
      lines.push(`- **${key}:** ${value}`);
    }
  }
  lines.push("");
  if (report.notes && report.notes.length > 0) {
    lines.push("## Notes");
    lines.push("");
    for (const note of report.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
