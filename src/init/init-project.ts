import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  createConfigTemplate,
  createExampleCapabilityTemplate,
  createIndexTemplate,
  createRegistryTemplate,
} from "./templates.js";
import type { InitFileReport, InitProjectOptions, InitProjectResult } from "./types.js";

export async function initProject(options: InitProjectOptions = {}): Promise<InitProjectResult> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const projectName = detectProjectName(cwd);
  const sourceRoot = detectSourceRoot(cwd);

  const configPath = join(cwd, "ai-capabilities.config.json");
  const configReport = ensureFile(configPath, createConfigTemplate({ projectName }));

  const indexPath = join(sourceRoot, "ai-capabilities/index.ts");
  const registryPath = join(sourceRoot, "ai-capabilities/registry.ts");
  const capabilityPath = join(sourceRoot, "ai-capabilities/capabilities/exampleCapability.ts");

  const indexReport = ensureFile(indexPath, createIndexTemplate());
  const registryReport = ensureFile(
    registryPath,
    createRegistryTemplate({ importPath: "./capabilities/exampleCapability" }),
  );
  const capabilityReport = ensureFile(capabilityPath, createExampleCapabilityTemplate());

  const nextSteps = [
    "Review ai-capabilities.config.json and adjust include/exclude paths for your repo.",
    "Replace src/ai-capabilities/capabilities/exampleCapability.ts with a real action.",
    "Run npx ai-capabilities inspect to see what the extractor picks up.",
    "Run npx ai-capabilities extract to build the manifest.",
    "Run npx ai-capabilities serve to expose the capability runtime.",
  ];

  return {
    projectName,
    sourceRoot,
    config: configReport,
    scaffold: [indexReport, registryReport, capabilityReport],
    nextSteps,
  };
}

function ensureFile(filePath: string, contents: string): InitFileReport {
  if (existsSync(filePath)) {
    return {
      path: filePath,
      status: "skipped",
      reason: "already exists",
    };
  }

  mkdirSync(dirname(filePath), { recursive: true });
  const normalized = contents.endsWith("\n") ? contents : `${contents}\n`;
  writeFileSync(filePath, normalized, "utf-8");
  return {
    path: filePath,
    status: "created",
  };
}

function detectProjectName(cwd: string): string {
  try {
    const pkgPath = join(cwd, "package.json");
    if (!existsSync(pkgPath)) return "App";
    const raw = readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as { name?: string };
    if (!parsed.name) return "App";
    return parsed.name;
  } catch {
    return "App";
  }
}

function detectSourceRoot(cwd: string): string {
  const candidates = ["src", "app", "packages/app/src"];
  for (const candidate of candidates) {
    const absolute = resolve(cwd, candidate);
    if (existsSync(absolute)) {
      return absolute;
    }
  }
  return resolve(cwd, "src");
}
