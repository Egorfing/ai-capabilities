import readline from "node:readline";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import type { AiCapabilitiesManifest, AiCapability, CapabilityPolicy } from "../../types/index.js";
import {
  PREFERRED_CAPABILITY_DIR,
  resolveCapabilityDirs,
  formatLegacyWarning,
} from "../../utils/capability-dirs.js";

const DEFAULT_MANIFEST_PATH = "output/ai-capabilities.json";
const DEFAULT_CAPABILITIES_DIR = `${PREFERRED_CAPABILITY_DIR}/capabilities`;
const DESTRUCTIVE_PATTERN = /(delete|remove|drop|destroy)/i;

export const scaffoldHelp = `
Usage: capability-engine scaffold --id <sourceId> [options]

Generate a defineCapabilityFromExtracted scaffold for an extracted capability.

Options:
  --id <sourceId>      Extracted capability id from inspect/extract (required)
  --list               List extracted capabilities without generating files
  --manifest <path>    Path to canonical manifest (default: ${DEFAULT_MANIFEST_PATH})
  --dir <path>         Output directory for capability files (default: ${DEFAULT_CAPABILITIES_DIR})
  --help               Show this help
`.trim();

export async function runScaffoldCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(scaffoldHelp);
    return;
  }

  let sourceId = typeof args.flags.id === "string" ? args.flags.id : undefined;
  const listOnly = Boolean(args.flags.list);
  const manifestPath = resolveFromCwd(
    typeof args.flags.manifest === "string" ? args.flags.manifest : DEFAULT_MANIFEST_PATH,
  );

  const capabilityDirs = resolveCapabilityDirs(process.cwd());
  const dirProvided = typeof args.flags.dir === "string";
  const resolvedDir = dirProvided ? (args.flags.dir as string) : capabilityDirs.capabilitiesDir.relative;
  const capabilitiesDir = resolveFromCwd(resolvedDir ?? DEFAULT_CAPABILITIES_DIR);

  if (!dirProvided && capabilityDirs.root.variant === "legacy") {
    console.warn(formatLegacyWarning());
  }

  const manifest = await loadManifest(manifestPath);

  if (listOnly) {
    await printCapabilityList(manifest);
    if (!manifest) {
      process.exitCode = 1;
    }
    return;
  }

  if (!sourceId) {
    if (!manifest) {
      printMissingIdHint(manifest, manifestPath);
      process.exitCode = 1;
      return;
    }

    if (isInteractiveTerminal() && manifest.capabilities?.length) {
      const selectedId = await promptForCapabilitySelection(manifest);
      if (!selectedId) {
        return;
      }
      sourceId = selectedId;
    } else {
      printMissingIdHint(manifest, manifestPath);
      process.exitCode = 1;
      return;
    }
  }

  if (!manifest) {
    throw new Error(
      `Manifest not found at ${manifestPath}. Run npx ai-capabilities extract before scaffolding capabilities.`,
    );
  }

  const capability = findCapability(manifest, sourceId);
  if (!capability) {
    throw new Error(
      `Capability "${sourceId}" not found in ${manifestPath}. Run extract/inspect and double-check the id.`,
    );
  }

  const fileBase = buildCapabilityFileBase(sourceId);
  const fileName = `${fileBase}.ts`;
  const filePath = path.join(capabilitiesDir, fileName);

  if (await fileExists(filePath)) {
    throw new Error(`Refusing to overwrite existing file: ${path.relative(process.cwd(), filePath)}`);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const template = buildCapabilityTemplate({
    capability,
    sourceId,
    exportName: fileBase,
  });
  await fs.writeFile(filePath, template, "utf-8");

  const relativePath = path.relative(process.cwd(), filePath);
  console.log(
    `[scaffold] created:\n${relativePath}\n\nNext steps:\n1. Implement the execute handler\n2. Register the capability in your registry.ts\n3. Run your runtime/agent to verify the capability`,
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

function printMissingIdHint(manifest: AiCapabilitiesManifest | undefined, manifestPath: string): void {
  console.error("No capability id provided.\n");
  if (!manifest) {
    console.error(`Canonical manifest not found at ${manifestPath}. Run npx ai-capabilities extract first.`);
    console.error("\nRun again with:\n  npx ai-capabilities scaffold --id <capability-id>");
    return;
  }
  if (!manifest.capabilities?.length) {
    console.error("Manifest contains no extracted capabilities yet.");
  } else {
    console.error("Available extracted capabilities:");
    manifest.capabilities
      .map((cap) => cap.id)
      .slice(0, 10)
      .forEach((id) => console.error(`  • ${id}`));
    if (manifest.capabilities.length > 10) {
      console.error(`  …and ${manifest.capabilities.length - 10} more`);
    }
  }
  console.error("\nRun again with:\n  npx ai-capabilities scaffold --id <capability-id>");
}

function findCapability(manifest: AiCapabilitiesManifest, sourceId: string): AiCapability | undefined {
  return (
    manifest.capabilities.find((cap) => cap.id === sourceId) ??
    manifest.capabilities.find((cap) =>
      cap.sources?.some((src) => src.location === sourceId || src.filePath === sourceId),
    )
  );
}

function resolveFromCwd(p: string): string {
  if (path.isAbsolute(p)) {
    return p;
  }
  return path.resolve(process.cwd(), p);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function buildCapabilityFileBase(sourceId: string): string {
  const withoutPrefix = sourceId.replace(/^hook[./]/i, "");
  const withoutSuffix = withoutPrefix.replace(/-(mutation|query)$/i, "");
  const camel = toCamelCase(withoutSuffix);
  return `${camel || "capability"}Capability`;
}

function toCamelCase(value: string): string {
  const parts = value.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  const [first, ...rest] = parts;
  let result =
    first.toLowerCase() + rest.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join("");
  if (!/^[a-zA-Z_]/.test(result)) {
    result = `cap${result.charAt(0).toUpperCase()}${result.slice(1)}`;
  }
  return result;
}

function buildCapabilityTemplate(options: {
  capability: AiCapability;
  sourceId: string;
  exportName: string;
}): string {
  const { capability, sourceId, exportName } = options;
  const policy = derivePolicyDefaults(sourceId, capability.policy);
  const inputSchema = capability.inputSchema ?? { type: "object", properties: {} };
  const aliases = capability.aliases ?? [];
  const exampleIntents = capability.exampleIntents ?? [];
  const tags = capability.tags ?? [];
  const displayTitle = capability.displayTitle ?? "TODO: title";
  const description = capability.description ?? "TODO: description";

  const template = `import { defineCapabilityFromExtracted } from "ai-capabilities";

export const ${exportName} = defineCapabilityFromExtracted({
  sourceId: "${sourceId}",
  // TODO: replace with your canonical id (e.g., "projects.create")
  id: "${capability.id}",
  displayTitle: ${JSON.stringify(displayTitle)},
  description: ${JSON.stringify(description)},
  inputSchema: ${formatLiteral(inputSchema, 4)},
  policy: ${formatLiteral(policy, 4)},
  aliases: ${formatLiteral(aliases, 4)},
  exampleIntents: ${formatLiteral(exampleIntents, 4)},
  tags: ${formatLiteral(tags, 4)},
  async execute(input, context) {
    throw new Error("TODO: implement execute handler for ${sourceId}");
  },
});
`;
  return template;
}

function derivePolicyDefaults(sourceId: string, existing?: CapabilityPolicy) {
  const destructive = DESTRUCTIVE_PATTERN.test(sourceId);
  return {
    visibility: existing?.visibility ?? "internal",
    riskLevel: destructive ? "high" : existing?.riskLevel ?? "medium",
    confirmationPolicy: destructive ? "always" : existing?.confirmationPolicy ?? "none",
  };
}

function formatLiteral(value: unknown, indentSize: number): string {
  const json = JSON.stringify(value, null, 2).replace(/"([a-zA-Z0-9_]+)":/g, "$1:");
  const indent = " ".repeat(indentSize);
  return json.replace(/\n/g, `\n${indent}`);
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptForCapabilitySelection(manifest: AiCapabilitiesManifest): Promise<string | undefined> {
  const capabilities = manifest.capabilities ?? [];
  if (!capabilities.length) {
    console.error("Manifest contains no extracted capabilities yet.");
    process.exitCode = 1;
    return undefined;
  }

  console.log("Available extracted capabilities:\n");
  capabilities.forEach((cap, index) => {
    console.log(`${index + 1}) ${cap.id}`);
  });
  console.log("");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question("Select a capability number: ", resolve));
  rl.close();

  const selection = Number.parseInt(answer.trim(), 10);
  if (Number.isNaN(selection) || selection < 1 || selection > capabilities.length) {
    console.error("Invalid selection. Run again with a valid number or provide --id.");
    process.exitCode = 1;
    return undefined;
  }

  const chosen = capabilities[selection - 1];
  console.log(`\nGenerating scaffold for:\n${chosen.id}\n`);
  return chosen.id;
}

async function printCapabilityList(manifest: AiCapabilitiesManifest | undefined): Promise<void> {
  if (!manifest) {
    console.log("No manifest found.");
    console.log("Run:\n");
    console.log("npx ai-capabilities extract");
    return;
  }

  const capabilities = manifest.capabilities ?? [];
  if (!capabilities.length) {
    console.log("Manifest contains no extracted capabilities yet.");
    return;
  }

  console.log("Extracted capabilities:\n");
  capabilities.forEach((cap, index) => {
    console.log(`${index + 1}. ${cap.id}`);
  });

  const firstId = capabilities[0]?.id;
  if (firstId) {
    console.log("\nTip:");
    console.log("Run:");
    console.log(`npx ai-capabilities scaffold --id ${firstId}`);
  }
}
