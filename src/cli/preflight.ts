import { existsSync } from "node:fs";
import { relative, resolve, join } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { initProject } from "../init/index.js";
import { detectSourceRoot } from "../init/init-project.js";
import { LEGACY_CAPABILITY_DIR, PREFERRED_CAPABILITY_DIR } from "../utils/capability-dirs.js";

const CONFIG_CANDIDATES = ["ai-capabilities.config.ts", "ai-capabilities.config.json"] as const;

interface InitArtifact {
  id: "config" | "registry" | "index";
  path: string;
  description: string;
  required: boolean;
}

interface DetectOptions {
  cwd: string;
  explicitConfigPath?: string;
}

export interface InitializationStatus {
  initialized: boolean;
  missingRequired: InitArtifact[];
  missingOptional: InitArtifact[];
  configPath?: string;
}

export interface EnsureInitializedOptions {
  cwd: string;
  commandLabel: string;
  explicitConfigPath?: string;
  interactive?: boolean;
  prompt?: (question: string) => Promise<boolean>;
}

export function detectInitializationStatus(options: DetectOptions): InitializationStatus {
  const { cwd } = options;
  const missingRequired: InitArtifact[] = [];
  const missingOptional: InitArtifact[] = [];

  let configPath: string | undefined;
  if (options.explicitConfigPath) {
    const abs = resolve(cwd, options.explicitConfigPath);
    if (existsSync(abs)) {
      configPath = abs;
    } else {
      missingRequired.push({
        id: "config",
        path: abs,
        description: "Configuration file that tells the CLI what to scan and where to write manifests.",
        required: true,
      });
    }
  } else {
    for (const candidate of CONFIG_CANDIDATES) {
      const abs = resolve(cwd, candidate);
      if (existsSync(abs)) {
        configPath = abs;
        break;
      }
    }
    if (!configPath) {
      missingRequired.push({
        id: "config",
        path: resolve(cwd, CONFIG_CANDIDATES[1]),
        description: "ai-capabilities.config.ts|json keeps project paths/output directories for every command.",
        required: true,
      });
    }
  }

  const sourceRoot = detectSourceRoot(cwd);
  const preferredRegistry = join(sourceRoot, "app-capabilities/registry.ts");
  const legacyRegistry = join(sourceRoot, "ai-capabilities/registry.ts");
  const preferredIndex = join(sourceRoot, "app-capabilities/index.ts");
  const legacyIndex = join(sourceRoot, "ai-capabilities/index.ts");

  if (!existsSync(preferredRegistry) && !existsSync(legacyRegistry)) {
    missingOptional.push({
      id: "registry",
      path: preferredRegistry,
      description: `Capability registry scaffold (created by ai-capabilities init). Legacy projects may still use ${LEGACY_CAPABILITY_DIR}/registry.ts.`,
      required: false,
    });
  }

  if (!existsSync(preferredIndex) && !existsSync(legacyIndex)) {
    missingOptional.push({
      id: "index",
      path: preferredIndex,
      description: `Entry point that re-exports your registered capabilities. Legacy projects may still use ${LEGACY_CAPABILITY_DIR}/index.ts.`,
      required: false,
    });
  }

  const initialized = missingRequired.length === 0;
  return { initialized, missingRequired, missingOptional, configPath };
}

export async function ensureInitializedForCommand(options: EnsureInitializedOptions): Promise<void> {
  const status = detectInitializationStatus({ cwd: options.cwd, explicitConfigPath: options.explicitConfigPath });
  if (status.initialized) return;

  const interactive =
    options.interactive ?? (process.stdin.isTTY && process.stdout.isTTY && !isCiEnvironment());
  const rel = (target: string) => relative(options.cwd, target) || target;

  const cliCommand = formatCommandInvocation(options.commandLabel);
  console.log("This project does not appear to be initialized for ai-capabilities yet.");
  console.log("Required setup files were not found:");
  console.log(formatMissingLines(status.missingRequired, rel));
  if (status.missingOptional.length) {
    console.log("\nOptional scaffolding that `ai-capabilities init` can create:");
    console.log(formatMissingLines(status.missingOptional, rel));
  }

  if (!interactive) {
    throw new Error(buildNonInteractiveMessage(cliCommand, status.missingRequired, rel));
  }

  const prompt = options.prompt ?? defaultPrompt;
  const shouldInit = await prompt(`Run \`ai-capabilities init\` now?`);
  if (!shouldInit) {
    throw new Error(
      `Initialization is required before running \`${cliCommand}\`. ` +
        "Run \`npx ai-capabilities init\` manually and retry.",
    );
  }

  console.log("\nRunning \`ai-capabilities init\` to bootstrap the project...\n");
  const result = await initProject({ cwd: options.cwd });
  printInitReport(result, options.cwd);
  console.log("");
}

function formatMissingLines(artifacts: InitArtifact[], rel: (path: string) => string): string {
  if (!artifacts.length) return "  • (none)";
  return artifacts
    .map((artifact) => `  • ${rel(artifact.path)} — ${artifact.description}`)
    .join("\n");
}

function buildNonInteractiveMessage(
  cliCommand: string,
  missing: InitArtifact[],
  rel: (path: string) => string,
): string {
  const missingList = missing.length
    ? missing.map((artifact) => `  • ${rel(artifact.path)} — ${artifact.description}`).join("\n")
    : "  • ai-capabilities.config.ts (or .json)";
  return [
    "This project does not appear to be initialized for ai-capabilities yet.",
    "Run `npx ai-capabilities init` first, then rerun this command.",
    `Command: ${cliCommand}`,
    "Missing:",
    missingList,
  ].join("\n");
}

function formatCommandInvocation(commandLabel: string): string {
  return commandLabel === "quick-scan" ? "npx ai-capabilities" : `npx ai-capabilities ${commandLabel}`;
}

function isCiEnvironment(): boolean {
  const value = process.env.CI;
  if (!value) return false;
  return value !== "0" && value.toLowerCase() !== "false";
}

async function defaultPrompt(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  const suffix = " [Y/n] ";
  try {
    while (true) {
      const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
      if (!answer) return true;
      if (answer === "y" || answer === "yes") return true;
      if (answer === "n" || answer === "no") return false;
      console.log("Please enter 'y' or 'n'.");
    }
  } finally {
    rl.close();
  }
}

function printInitReport(result: Awaited<ReturnType<typeof initProject>>, cwd: string): void {
  const rel = (target: string) => relative(cwd, target) || target;
  console.log(`[init] Project: ${result.projectName}`);
  for (const report of [result.config, ...result.scaffold]) {
    const status = report.status === "created" ? "created" : "skipped";
    const suffix = report.reason ? ` (${report.reason})` : "";
    console.log(`[init] ${status.padEnd(7)} ${rel(report.path)}${suffix}`);
  }
  console.log("\nNext steps:");
  result.nextSteps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step}`);
  });
}
