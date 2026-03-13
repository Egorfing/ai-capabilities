import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { loadConfig } from "../config/load-config.js";
import type { ResolvedConfig } from "../config/types.js";
import type { AiCapabilitiesManifest, AiCapability } from "../types/index.js";
import { BindingResolver, BindingRegistry } from "../binding/index.js";
import type {
  DoctorRunOptions,
  DoctorReport,
  DoctorFileCheck,
  DoctorCapabilityStats,
  DoctorIssue,
  DoctorScaffoldInfo,
  DoctorStatus,
} from "./doctor-types.js";

const STATUS_ORDER: DoctorStatus[] = [
  "not_initialized",
  "initialized",
  "extracted",
  "discoverable",
  "partially_executable",
  "pilot_ready",
];

export async function runDoctor(options: DoctorRunOptions = {}): Promise<DoctorReport> {
  const cwd = options.cwd ?? process.cwd();
  let config: ResolvedConfig | undefined;
  let configError: Error | undefined;

  try {
    config = await loadConfig({ configPath: options.configPath, cwd });
  } catch (err) {
    configError = err as Error;
  }

  if (!config) {
    return {
      status: "not_initialized",
      configOk: false,
      configError: configError?.message ?? "ai-capabilities.config.json not found",
      outputChecks: {},
      safetyWarnings: [],
      issues: [
        {
          code: "CONFIG_MISSING",
          severity: "high",
          message: configError?.message ?? "Config file not found. Run `npx ai-capabilities init`.",
        },
      ],
      nextSteps: ["Run npx ai-capabilities init"],
    } satisfies DoctorReport;
  }

  const cwdRelative = (path: string) => relative(cwd, path) || path;
  const projectPath = options.projectPath ? resolve(cwd, options.projectPath) : config.project.root;
  const finalConfig: ResolvedConfig = {
    ...config,
    project: { ...config.project, root: projectPath },
  };

  const outputChecks = buildOutputChecks(finalConfig, cwdRelative);
  const { manifest, manifestError } = loadManifestSafe(finalConfig.output.canonical);
  const stats = manifest ? analyzeManifest(manifest) : undefined;
  const scaffold = detectScaffold(projectPath, cwdRelative);
  const safetyWarnings = buildSafetyWarnings(stats, manifest);

  const issues: DoctorIssue[] = [];
  const nextSteps: string[] = [];

  if (!outputChecks.raw?.exists) {
    issues.push({
      code: "RAW_MANIFEST_MISSING",
      severity: "medium",
      message: "Raw manifest not found. Run `npx ai-capabilities extract`.",
    });
    nextSteps.push("Run npx ai-capabilities extract");
  }
  if (!outputChecks.canonical?.exists) {
    issues.push({
      code: "CANONICAL_MANIFEST_MISSING",
      severity: "medium",
      message: "Canonical manifest not found. Run `npx ai-capabilities extract`.",
    });
    if (!nextSteps.includes("Run npx ai-capabilities extract")) {
      nextSteps.push("Run npx ai-capabilities extract");
    }
  }
  if (outputChecks.canonical?.exists && manifestError) {
    issues.push({
      code: "CANONICAL_MANIFEST_INVALID",
      severity: "medium",
      message: `Failed to parse canonical manifest: ${manifestError.message}`,
    });
    nextSteps.push("Re-run npx ai-capabilities extract to regenerate the manifest");
  }
  if (!outputChecks.enriched?.exists) {
    issues.push({
      code: "ENRICHED_MANIFEST_MISSING",
      severity: "low",
      message: "Enriched manifest not found. Run `npx ai-capabilities enrich`.",
    });
    nextSteps.push("Run npx ai-capabilities enrich");
  }
  if (!outputChecks.diagnostics?.exists) {
    issues.push({
      code: "DIAGNOSTICS_MISSING",
      severity: "low",
      message: "Diagnostics log not found. Run extraction to generate diagnostics.",
    });
  }

  if (stats) {
    if (stats.total === 0) {
      issues.push({
        code: "NO_CAPABILITIES",
        severity: "high",
        message: "Canonical manifest contains zero capabilities.",
      });
      nextSteps.push("Define capabilities with defineCapability(...) or add new extractors");
    } else {
      if (stats.executable === 0) {
        issues.push({
          code: "NO_EXECUTABLE_CAPABILITIES",
          severity: "medium",
          message: "Capabilities exist but bindings/execution details are missing.",
        });
        nextSteps.push("Register capabilities or add execution bindings");
      }
      if (stats.publicCount === 0) {
        issues.push({
          code: "NO_PUBLIC_CAPABILITIES",
          severity: "low",
          message: "No public capabilities detected. Only internal agents can access them.",
        });
      }
      if (stats.highRisk > 0) {
        issues.push({
          code: "HIGH_RISK_PRESENT",
          severity: "medium",
          message: `${stats.highRisk} high-risk capabilities detected. Ensure policy overrides or deny rules are in place.`,
        });
        nextSteps.push("Create a pilot allowlist with npx ai-capabilities prompt --template allowlist");
      }
    }
  }

  if (!scaffold.present) {
    issues.push({
      code: "NO_LOCAL_SCAFFOLD",
      severity: "low",
      message: "Local capability scaffold not found (expected src/ai-capabilities/).",
    });
    nextSteps.push("Run npx ai-capabilities init to create the scaffold");
  }

  const status = determineStatus({ config: finalConfig, stats, manifestPresent: outputChecks.canonical?.exists ?? false });

  return {
    status,
    projectPath,
    configPath: finalConfig.filePath,
    configOk: true,
    outputChecks,
    capabilityStats: stats,
    scaffold,
    safetyWarnings,
    issues: dedupeIssues(issues),
    nextSteps: dedupeStrings(nextSteps),
  } satisfies DoctorReport;
}

function buildOutputChecks(config: ResolvedConfig, rel: (path: string) => string) {
  const checks: DoctorReport["outputChecks"] = {};
  const files: Array<[keyof DoctorReport["outputChecks"], string]> = [
    ["raw", config.output.raw],
    ["canonical", config.output.canonical],
    ["public", config.output.public],
    ["enriched", config.output.enriched],
    ["diagnostics", config.output.diagnostics],
  ];
  for (const [key, path] of files) {
    const exists = existsSync(path);
    (checks[key] = {
      ok: exists,
      exists,
      path: rel(path),
    });
  }
  const tracesDir = config.output.tracesDir;
  const tracesExists = existsSync(tracesDir);
  checks.tracesDir = {
    ok: tracesExists,
    exists: tracesExists,
    path: rel(tracesDir),
    message: tracesExists ? undefined : "Traces directory missing",
  };
  return checks;
}

function loadManifestSafe(path: string): { manifest?: AiCapabilitiesManifest; manifestError?: Error } {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    const json = JSON.parse(raw) as AiCapabilitiesManifest;
    if (!Array.isArray(json.capabilities)) {
      throw new Error("Manifest missing capabilities array");
    }
    return { manifest: json };
  } catch (err) {
    return { manifestError: err as Error };
  }
}

function analyzeManifest(manifest: AiCapabilitiesManifest): DoctorCapabilityStats {
  const resolver = new BindingResolver(manifest, new BindingRegistry());
  const byKind: Record<string, number> = {};
  const byVisibility: Record<string, number> = {};
  let executable = 0;
  let unbound = 0;
  let publicCount = 0;
  let confirmationRequired = 0;
  let highRisk = 0;
  const unboundIds: string[] = [];

  for (const cap of manifest.capabilities) {
    byKind[cap.kind] = (byKind[cap.kind] ?? 0) + 1;
    const visibility = cap.policy.visibility;
    byVisibility[visibility] = (byVisibility[visibility] ?? 0) + 1;
    if (visibility === "public") publicCount += 1;
    if (cap.policy.confirmationPolicy && cap.policy.confirmationPolicy !== "none") {
      confirmationRequired += 1;
    }
    if (cap.policy.riskLevel === "high" || cap.policy.riskLevel === "critical") {
      highRisk += 1;
    }
    const resolution = resolver.resolve(cap.id);
    if (resolution.ok) executable += 1;
    else {
      unbound += 1;
      unboundIds.push(cap.id);
    }
  }

  return {
    total: manifest.capabilities.length,
    byKind,
    byVisibility,
    publicCount,
    executable,
    unbound,
    confirmationRequired,
    highRisk,
    unboundIds,
  };
}

function detectScaffold(projectPath: string, rel: (path: string) => string): DoctorScaffoldInfo {
  const base = resolve(projectPath, "src/ai-capabilities");
  const registry = join(base, "registry.ts");
  const capDir = join(base, "capabilities");
  const example = join(capDir, "exampleCapability.ts");
  const present = existsSync(base);
  const info: DoctorScaffoldInfo = {
    present,
    directory: rel(base),
    registryExists: existsSync(registry),
    capabilitiesDirExists: existsSync(capDir),
    exampleCapabilityExists: existsSync(example),
  };
  return info;
}

function buildSafetyWarnings(stats?: DoctorCapabilityStats, manifest?: AiCapabilitiesManifest): string[] {
  if (!stats || !manifest) return [];
  const warnings: string[] = [];
  if (stats.highRisk > 0 && stats.publicCount > 0) {
    warnings.push("High-risk capabilities are marked public. Create deny rules or confirmation policies.");
  }
  const destructiveWords = ["delete", "remove", "destroy", "terminate", "drop"]; 
  const destructive = manifest.capabilities.filter((cap) =>
    destructiveWords.some((word) =>
      cap.id.toLowerCase().includes(word) ||
      cap.displayTitle?.toLowerCase().includes(word) ||
      cap.description?.toLowerCase().includes(word),
    ),
  );
  if (destructive.length > 0) {
    warnings.push(`Potential destructive capabilities detected: ${destructive
      .slice(0, 5)
      .map((cap) => cap.id)
      .join(", ")}`);
  }
  if (stats.publicCount === 0) {
    warnings.push("No public capabilities detected. External agents will not find any tools yet.");
  }
  if (stats.executable === 0) {
    warnings.push("All capabilities appear unbound. Define execution handlers or runtime bindings.");
  }
  if (stats.unbound > 0) {
    const samples = (stats.unboundIds ?? []).slice(0, 3);
    const hint = samples.length > 0 ? ` (e.g., ${samples.join(", ")})` : "";
    warnings.push(
      `Capabilities detected but not executable${hint}. Suggested next step: npx ai-capabilities scaffold --id <capability-id>.`,
    );
  }
  return warnings;
}

function determineStatus(input: {
  config: ResolvedConfig;
  stats?: DoctorCapabilityStats;
  manifestPresent: boolean;
}): DoctorStatus {
  if (!input.manifestPresent) return "initialized";
  if (!input.stats || input.stats.total === 0) return "extracted";
  if (input.stats.executable === 0) return "discoverable";
  if (input.stats.executable > 0 && input.stats.publicCount === 0) return "partially_executable";
  return "pilot_ready";
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeIssues(issues: DoctorIssue[]): DoctorIssue[] {
  const seen = new Set<string>();
  const result: DoctorIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result;
}
