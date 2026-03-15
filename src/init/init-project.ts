import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import {
  createConfigTemplate,
  createExampleCapabilityTemplate,
  createIndexTemplate,
  createRegistryTemplate,
} from "./templates.js";
import type { InitFileReport, InitProjectOptions, InitProjectResult } from "./types.js";
import {
  formatLegacyWarning,
  LEGACY_CAPABILITY_DIR,
  PREFERRED_CAPABILITY_DIR,
} from "../utils/capability-dirs.js";

export async function initProject(options: InitProjectOptions = {}): Promise<InitProjectResult> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const projectName = detectProjectName(cwd);
  const sourceRoot = detectSourceRoot(cwd);

  const configPath = join(cwd, "ai-capabilities.config.json");
  const configReport = ensureFile(configPath, createConfigTemplate({ projectName }));

  const preferredBase = join(sourceRoot, "app-capabilities");
  const legacyBase = join(sourceRoot, "ai-capabilities");
  const legacyExists = existsSync(legacyBase);
  const preferredExists = existsSync(preferredBase);
  const useLegacy = !preferredExists && legacyExists;
  const baseDir = useLegacy ? legacyBase : preferredBase;
  const baseLabel = relative(cwd, baseDir) || (useLegacy ? LEGACY_CAPABILITY_DIR : PREFERRED_CAPABILITY_DIR);

  if (useLegacy) {
    console.warn(formatLegacyWarning());
  }

  const indexPath = join(baseDir, "index.ts");
  const registryPath = join(baseDir, "registry.ts");
  const capabilityPath = join(baseDir, "capabilities/exampleCapability.ts");

  const indexReport = ensureFile(indexPath, createIndexTemplate());
  const registryReport = ensureFile(
    registryPath,
    createRegistryTemplate({ importPath: "./capabilities/exampleCapability" }),
  );
  const capabilityReport = ensureFile(capabilityPath, createExampleCapabilityTemplate());

  const nextSteps = [
    "Inspect your project: npx ai-capabilities inspect",
    "Extract discovered capabilities: npx ai-capabilities extract",
    "Scaffold executable capabilities: npx ai-capabilities scaffold --id <capability-id>",
    `Register new capabilities in ${baseLabel}/registry.ts and wire them into your runtime (legacy: ${LEGACY_CAPABILITY_DIR}).`,
    "Serve or test the runtime: npx ai-capabilities serve",
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

export function detectSourceRoot(cwd: string): string {
  const candidates = ["src", "app", "packages/app/src"];
  for (const candidate of candidates) {
    const absolute = resolve(cwd, candidate);
    if (existsSync(absolute)) {
      return absolute;
    }
  }
  return resolve(cwd, "src");
}
