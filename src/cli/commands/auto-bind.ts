import { promises as fs } from "node:fs";
import path from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import type { AiCapabilitiesManifest, AiCapability, CapabilityPolicy } from "../../types/index.js";
import {
  analyzeAutoBindCandidates,
  buildCapabilityFileBase,
  type AutoDecision,
  type SkipDecision,
} from "../../auto-bind/auto-bind-planner.js";

const DEFAULT_MANIFEST_PATH = "output/ai-capabilities.json";
const DEFAULT_AUTO_DIR = "src/ai-capabilities/auto";
const DESTRUCTIVE_PATTERN = /(delete|remove|drop|destroy|wipe|reset|terminate)/i;

export const autoBindHelp = `
Usage: capability-engine auto-bind [options]

Automatically scaffold safe capabilities from the extracted manifest.

Options:
  --manifest <path>    Path to canonical manifest (default: ${DEFAULT_MANIFEST_PATH})
  --dir <path>         Output directory for auto-bound files (default: ${DEFAULT_AUTO_DIR})
  --dry-run            Show what would be generated without writing files
  --help               Show this help
`.trim();

interface AutoBindRecord {
  capability: AiCapability;
  sourceId: string;
  targetId: string;
  filePath: string;
}

export async function runAutoBindCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(autoBindHelp);
    return;
  }

  const manifestPath = resolveFromCwd(
    typeof args.flags.manifest === "string" ? args.flags.manifest : DEFAULT_MANIFEST_PATH,
  );
  const targetDir = resolveFromCwd(typeof args.flags.dir === "string" ? args.flags.dir : DEFAULT_AUTO_DIR);
  const dryRun = Boolean(args.flags["dry-run"] ?? args.flags.dryrun ?? args.flags.dryRun);

  const manifest = await loadManifest(manifestPath);
  if (!manifest) {
    throw new Error(
      `Manifest not found at ${manifestPath}. Run npx ai-capabilities extract before auto-binding capabilities.`,
    );
  }

  const plan = analyzeAutoBindCandidates(manifest);
  const plannedAuto = plan.auto;
  const skippedDangerous = plan.dangerous;
  const skippedUncertain = plan.uncertain;

  const boundRecords: AutoBindRecord[] = [];
  const skippedBecauseExisting: Array<{ capability: AiCapability; reason: string }> = [];

  for (const candidate of plannedAuto) {
    const fileName = `${candidate.fileBase}.ts`;
    const filePath = path.join(targetDir, fileName);
    if (!dryRun && (await fileExists(filePath))) {
      skippedBecauseExisting.push({
        capability: candidate.capability,
        reason: `File already exists at ${path.relative(process.cwd(), filePath)}`,
      });
      continue;
    }

    const template = buildCapabilityTemplate({
      capability: candidate.capability,
      sourceId: candidate.sourceId,
      targetId: candidate.targetId,
    });

    if (!dryRun) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, template, "utf-8");
    }

    boundRecords.push({
      capability: candidate.capability,
      sourceId: candidate.sourceId,
      targetId: candidate.targetId,
      filePath,
    });
  }

  console.log(`[auto-bind] loaded ${manifest.capabilities.length} extracted capabilities`);

  if (boundRecords.length) {
    console.log("[auto-bind] auto-bound:");
    boundRecords.forEach((record) => {
      console.log(`  • ${record.sourceId} → ${record.targetId}`);
    });
  } else {
    console.log("[auto-bind] auto-bound: none");
  }

  if (skippedDangerous.length) {
    console.log("[auto-bind] skipped dangerous:");
    skippedDangerous.forEach((entry) => {
      console.log(`  • ${entry.capability.id} — ${entry.reason}`);
    });
  }

  const allUncertain = [...skippedUncertain, ...skippedBecauseExisting];
  if (allUncertain.length) {
    console.log("[auto-bind] skipped uncertain:");
    allUncertain.forEach((entry) => {
      console.log(`  • ${entry.capability.id} — ${entry.reason}`);
    });
  }

  if (boundRecords.length) {
    if (dryRun) {
      console.log("[auto-bind] dry-run: no files written");
    } else {
      console.log("\nCreated:");
      boundRecords.forEach((record) => {
        console.log(`  ${path.relative(process.cwd(), record.filePath)}`);
      });
    }
  }

  if (!dryRun && !boundRecords.length) {
    console.log("No files created. Resolve skipped items or run with --dry-run to preview changes.");
  }

  console.log(
    "\nNext steps:\n  1. Review generated files\n  2. Register them in src/ai-capabilities/registry.ts\n  3. Run npx ai-capabilities doctor",
  );
}

async function loadManifest(manifestPath: string): Promise<AiCapabilitiesManifest | undefined> {
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(content) as AiCapabilitiesManifest;
  } catch {
    return undefined;
  }
}

function resolveFromCwd(p: string): string {
  if (path.isAbsolute(p)) {
    return p;
  }
  return path.resolve(process.cwd(), p);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildCapabilityTemplate(options: {
  capability: AiCapability;
  sourceId: string;
  targetId: string;
}): string {
  const { capability, sourceId, targetId } = options;
  const exportName = buildCapabilityFileBase(sourceId);
  const policy = derivePolicyDefaults(capability, capability.policy);
  const inputSchema = capability.inputSchema ?? { type: "object", properties: {} };
  const aliases = capability.aliases ?? [];
  const exampleIntents = capability.exampleIntents ?? [];
  const tags = capability.tags ?? [];
  const displayTitle = capability.displayTitle ?? `TODO: ${targetId}`;
  const description = capability.description ?? capability.userDescription ?? "TODO: description";
  const executionHint = buildExecutionHint(capability);

  const template = `import { defineCapabilityFromExtracted } from "ai-capabilities";

export const ${exportName} = defineCapabilityFromExtracted({
  sourceId: "${sourceId}",
  id: "${targetId}",
  displayTitle: ${JSON.stringify(displayTitle)},
  description: ${JSON.stringify(description)},
  inputSchema: ${formatLiteral(inputSchema, 2)},
  policy: ${formatLiteral(policy, 2)},
  aliases: ${formatLiteral(aliases, 2)},
  exampleIntents: ${formatLiteral(exampleIntents, 2)},
  tags: ${formatLiteral(tags, 2)},
  async execute(input, context) {
${executionHint ? `    ${executionHint}\n` : ""}    throw new Error("TODO: implement ${targetId} capability");
  },
});
`;
  return template;
}

function buildExecutionHint(capability: AiCapability): string | undefined {
  const endpoint = capability.execution?.endpoint;
  if (!endpoint) {
    return undefined;
  }
  const method = endpoint.method ? endpoint.method.toUpperCase() : "GET";
  const base = endpoint.baseUrl ? ` (base ${endpoint.baseUrl})` : "";
  const pathSegment = endpoint.path ?? "";
  return `// Endpoint hint: ${method} ${pathSegment}${base}`;
}

function derivePolicyDefaults(capability: AiCapability, existing?: CapabilityPolicy) {
  const destructive = DESTRUCTIVE_PATTERN.test(capability.id);
  return {
    visibility: existing?.visibility ?? "internal",
    riskLevel: destructive ? "high" : existing?.riskLevel ?? "medium",
    confirmationPolicy: destructive ? "always" : existing?.confirmationPolicy ?? (capability.kind === "read" ? "none" : "once"),
  };
}

function formatLiteral(value: unknown, indentSize: number): string {
  const json = JSON.stringify(value, null, 2).replace(/"([a-zA-Z0-9_]+)":/g, "$1:");
  const indent = " ".repeat(indentSize);
  return json.replace(/\n/g, `\n${indent}`);
}
