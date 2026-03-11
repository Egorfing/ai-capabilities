import type { CapabilityKind } from "../types/index.js";
import type { InspectSummary, InspectCapabilityInfo } from "./inspect-types.js";

const KIND_ORDER: CapabilityKind[] = ["mutation", "read", "workflow", "ui-action", "navigation"];
const KIND_LABELS: Record<CapabilityKind, string> = {
  mutation: "Mutations",
  read: "Reads",
  navigation: "Navigation",
  "ui-action": "UI Actions",
  workflow: "Workflows",
};

export function formatInspectSummaryOutput(
  summary: InspectSummary,
): string {
  const lines: string[] = [];
  lines.push(`# ${summary.appName} — Inspect`);
  lines.push(`Project: ${summary.projectPath}`);
  lines.push(`Config: ${summary.configPath}`);
  lines.push(`Manifest version: ${summary.manifestVersion}`);
  lines.push("");
  const noun = summary.metrics.total === 1 ? "capability" : "capabilities";
  lines.push(`Found ${summary.metrics.total} ${noun} (${summary.metrics.totalAll} total in manifest)`);
  if (hasFilters(summary.filters)) {
    lines.push(`Filters: ${formatFilters(summary.filters)}`);
  }
  lines.push("");
  lines.push(
    `Public: ${summary.metrics.publicCount} • Executable: ${summary.metrics.executable} • Unbound: ${summary.metrics.unbound}`,
  );
  lines.push(
    `Confirmation required: ${summary.metrics.confirmationRequired} • High risk: ${summary.metrics.highRisk}`,
  );
  lines.push(
    `Diagnostics — errors: ${summary.diagnosticsSummary.errors}, warnings: ${summary.diagnosticsSummary.warnings}, info: ${summary.diagnosticsSummary.infos}`,
  );
  if (summary.extractorsRun.length > 0) {
    lines.push(`Extractors: ${summary.extractorsRun.join(", ")}`);
  }
  lines.push("");

  const grouped = groupByKind(summary.capabilities);
  let sectionsPrinted = 0;
  for (const kind of KIND_ORDER) {
    const items = grouped[kind];
    if (!items || items.length === 0) continue;
    const label = KIND_LABELS[kind as CapabilityKind] ?? kind;
    lines.push(`## ${label} (${items.length})`);
    for (const info of items) {
      lines.push(formatCapabilityLine(info));
    }
    lines.push("");
    sectionsPrinted += 1;
  }
  if (sectionsPrinted === 0) {
    lines.push("No capabilities matched the selected filters.");
    lines.push("");
  }

  const publicCaps = summary.capabilities.filter(
    (info) => info.capability.policy.visibility === "public",
  );
  lines.push("## Public capabilities");
  if (publicCaps.length === 0) {
    lines.push("- (none)");
  } else {
    for (const info of publicCaps) {
      lines.push(`- ${info.capability.id}`);
    }
  }
  lines.push("");

  lines.push("## Unsupported patterns");
  if (summary.warnings.length === 0) {
    lines.push("- (none)");
  } else {
    for (const warning of summary.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

function formatFilters(filters: InspectSummary["filters"]): string {
  const pieces: string[] = [];
  if (filters.publicOnly) pieces.push("public only");
  if (filters.kind) pieces.push(`kind=${filters.kind}`);
  if (filters.unboundOnly) pieces.push("unbound only");
  return pieces.join(", ");
}

function hasFilters(filters: InspectSummary["filters"]): boolean {
  return Boolean(filters.publicOnly || filters.kind || filters.unboundOnly);
}

function formatCapabilityLine(info: InspectCapabilityInfo): string {
  const tokens: string[] = [];
  tokens.push(info.capability.policy.visibility);
  tokens.push(info.executable ? "executable" : "unbound");
  if (info.requiresConfirmation) {
    tokens.push("confirmation");
  }
  tokens.push(`${info.capability.policy.riskLevel} risk`);
  const status = tokens.join(" | ");
  const id = info.capability.id.length > 28
    ? info.capability.id
    : info.capability.id.padEnd(28, " ");
  return `- ${id} ${status}`;
}

function groupByKind(
  infos: InspectCapabilityInfo[],
): Record<CapabilityKind, InspectCapabilityInfo[]> {
  const groups = Object.fromEntries(
    KIND_ORDER.map((kind) => [kind, [] as InspectCapabilityInfo[]]),
  ) as Record<CapabilityKind, InspectCapabilityInfo[]>;
  for (const info of infos) {
    const list = groups[info.capability.kind] ?? (groups[info.capability.kind] = []);
    list.push(info);
  }
  return groups;
}
