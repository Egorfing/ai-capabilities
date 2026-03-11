import type { ParsedArgs } from "../parse-args.js";
import type { CapabilityKind } from "../../types/index.js";
import {
  runInspectPipeline,
  buildInspectSummary,
  formatInspectSummaryOutput,
} from "../../inspect/index.js";
import type { InspectFilters } from "../../inspect/index.js";

const KIND_VALUES: CapabilityKind[] = ["mutation", "read", "navigation", "ui-action", "workflow"];

export const inspectHelp = `
Usage: capability-engine inspect [options]

Inspect a project's canonical manifest without writing files.

Options:
  --project <path>   Override project root
  --config <path>    Path to ai-capabilities.config.json|ts
  --public           Show only public capabilities
  --kind <kind>      Filter by capability kind (${KIND_VALUES.join(", ")})
  --unbound-only     Show only capabilities without bindings
  --json             Output JSON summary instead of text
  --help             Show this help
`.trim();

export async function runInspectCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(inspectHelp);
    return;
  }

  const filters = parseFilters(args);

  const result = await runInspectPipeline({
    projectPath: typeof args.flags.project === "string" ? args.flags.project : undefined,
    configPath: typeof args.flags.config === "string" ? args.flags.config : undefined,
    cwd: process.cwd(),
  });

  const summary = buildInspectSummary(result, filters);

  if (isJsonRequested(args)) {
    console.log(JSON.stringify(toJsonSummary(summary), null, 2));
    return;
  }

  console.log(formatInspectSummaryOutput(summary));
}

function parseFilters(args: ParsedArgs): InspectFilters {
  const filters: InspectFilters = {};
  if (isFlagEnabled(args.flags.public)) {
    filters.publicOnly = true;
  }
  if (isFlagEnabled(args.flags["unbound-only"])) {
    filters.unboundOnly = true;
  }
  if (typeof args.flags.kind === "string") {
    if (!KIND_VALUES.includes(args.flags.kind as CapabilityKind)) {
      throw new Error(
        `Invalid --kind value "${args.flags.kind}". Expected one of: ${KIND_VALUES.join(", ")}`,
      );
    }
    filters.kind = args.flags.kind as CapabilityKind;
  }
  return filters;
}

function isJsonRequested(args: ParsedArgs): boolean {
  return isFlagEnabled(args.flags.json);
}

function isFlagEnabled(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
    return normalized === "" ? true : true;
  }
  return Boolean(value);
}

function toJsonSummary(summary: ReturnType<typeof buildInspectSummary>): unknown {
  return {
    projectPath: summary.projectPath,
    configPath: summary.configPath,
    app: summary.appName,
    manifestVersion: summary.manifestVersion,
    filters: summary.filters,
    metrics: summary.metrics,
    diagnostics: summary.diagnosticsSummary,
    warnings: summary.warnings,
    extractors: summary.extractorsRun,
    capabilities: summary.capabilities.map((info) => ({
      id: info.capability.id,
      displayTitle: info.capability.displayTitle,
      kind: info.capability.kind,
      visibility: info.capability.policy.visibility,
      riskLevel: info.capability.policy.riskLevel,
      confirmationPolicy: info.capability.policy.confirmationPolicy,
      executable: info.executable,
      requiresConfirmation: info.requiresConfirmation,
      bindingMode: info.bindingMode,
      bindingSource: info.bindingSource,
      bindingErrorCode: info.bindingErrorCode,
    })),
  };
}
