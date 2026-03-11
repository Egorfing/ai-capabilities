import { BindingRegistry, BindingResolver } from "../binding/index.js";
import { collectUnsupportedPatterns } from "../pilot/pilot-report.js";
import { summarizeDiagnostics } from "../utils/diagnostics.js";
import type {
  AiCapability,
  CapabilityKind,
  Visibility,
} from "../types/index.js";
import type {
  InspectFilters,
  InspectLoadResult,
  InspectSummary,
  InspectCapabilityInfo,
  InspectSummaryMetrics,
} from "./inspect-types.js";

const KIND_ORDER: CapabilityKind[] = ["mutation", "read", "workflow", "ui-action", "navigation"];
const VISIBILITY_ORDER: Visibility[] = ["public", "internal", "hidden"];

export function buildInspectSummary(
  data: InspectLoadResult,
  filters: InspectFilters = {},
): InspectSummary {
  const diagnosticsSummary = summarizeDiagnostics(data.diagnostics);
  const warnings = collectUnsupportedPatterns(data.diagnostics);
  const bindingResolver = new BindingResolver(data.manifest, new BindingRegistry());

  const infos = data.manifest.capabilities.map<InspectCapabilityInfo>((cap) => {
    const resolution = bindingResolver.resolve(cap.id);
    if (resolution.ok) {
      return {
        capability: cap,
        executable: true,
        bindingMode: resolution.binding.mode,
        bindingSource: resolution.binding.source,
        requiresConfirmation: cap.policy.confirmationPolicy !== "none",
        isHighRisk: cap.policy.riskLevel === "high" || cap.policy.riskLevel === "critical",
      };
    }
    return {
      capability: cap,
      executable: false,
      bindingErrorCode: resolution.error.code,
      requiresConfirmation: cap.policy.confirmationPolicy !== "none",
      isHighRisk: cap.policy.riskLevel === "high" || cap.policy.riskLevel === "critical",
    };
  });

  const filtered = infos.filter((info) => matchFilters(info, filters));
  const sorted = sortCapabilities(filtered);
  const metrics = computeMetrics({
    allCount: data.manifest.capabilities.length,
    infos: sorted,
  });

  return {
    projectPath: data.projectPath,
    configPath: data.config.filePath,
    manifestVersion: data.manifest.manifestVersion,
    appName: data.manifest.app.name,
    filters,
    metrics,
    capabilities: sorted,
    warnings,
    diagnosticsSummary,
    extractorsRun: data.extractorsRun,
  };
}

function matchFilters(info: InspectCapabilityInfo, filters: InspectFilters): boolean {
  if (filters.publicOnly && info.capability.policy.visibility !== "public") {
    return false;
  }
  if (filters.kind && info.capability.kind !== filters.kind) {
    return false;
  }
  if (filters.unboundOnly && info.executable) {
    return false;
  }
  return true;
}

function sortCapabilities(infos: InspectCapabilityInfo[]): InspectCapabilityInfo[] {
  return [...infos].sort((a, b) => {
    const kindOrder = KIND_ORDER.indexOf(a.capability.kind) - KIND_ORDER.indexOf(b.capability.kind);
    if (kindOrder !== 0) return kindOrder;
    return a.capability.id.localeCompare(b.capability.id);
  });
}

function computeMetrics(input: {
  allCount: number;
  infos: InspectCapabilityInfo[];
}): InspectSummaryMetrics {
  const byKind: InspectSummaryMetrics["byKind"] = Object.fromEntries(
    KIND_ORDER.map((kind) => [kind, 0]),
  ) as InspectSummaryMetrics["byKind"];
  const byVisibility: InspectSummaryMetrics["byVisibility"] = Object.fromEntries(
    VISIBILITY_ORDER.map((vis) => [vis, 0]),
  ) as InspectSummaryMetrics["byVisibility"];

  let confirmationRequired = 0;
  let highRisk = 0;
  let executable = 0;
  let unbound = 0;

  for (const info of input.infos) {
    byKind[info.capability.kind] = (byKind[info.capability.kind] ?? 0) + 1;
    byVisibility[info.capability.policy.visibility] =
      (byVisibility[info.capability.policy.visibility] ?? 0) + 1;
    if (info.requiresConfirmation) confirmationRequired += 1;
    if (info.isHighRisk) highRisk += 1;
    if (info.executable) executable += 1;
    else unbound += 1;
  }

  return {
    totalAll: input.allCount,
    total: input.infos.length,
    byKind,
    byVisibility,
    confirmationRequired,
    highRisk,
    executable,
    unbound,
    publicCount: byVisibility.public ?? 0,
  };
}
