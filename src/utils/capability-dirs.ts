import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const PREFERRED_CAPABILITY_DIR = "src/app-capabilities";
export const LEGACY_CAPABILITY_DIR = "src/ai-capabilities";

export type CapabilityDirVariant = "preferred" | "legacy";

export interface CapabilityPathInfo {
  absolute: string;
  relative: string;
  variant: CapabilityDirVariant;
  exists: boolean;
}

export interface CapabilityDirSet {
  root: CapabilityPathInfo;
  capabilitiesDir: CapabilityPathInfo;
  autoDir: CapabilityPathInfo;
  registryFile: CapabilityPathInfo;
  legacyRootExists: boolean;
}

function buildRelative(root: string, suffix?: string): string {
  if (!suffix) return root;
  return `${root}/${suffix}`;
}

export function resolveCapabilityDirs(cwd: string = process.cwd()): CapabilityDirSet {
  const projectRoot = resolve(cwd);
  const preferredRoot = resolve(projectRoot, PREFERRED_CAPABILITY_DIR);
  const legacyRoot = resolve(projectRoot, LEGACY_CAPABILITY_DIR);
  const preferredExists = existsSync(preferredRoot);
  const legacyExists = existsSync(legacyRoot);

  let rootAbsolute = preferredRoot;
  let rootRelative = PREFERRED_CAPABILITY_DIR;
  let variant: CapabilityDirVariant = "preferred";
  let rootExists = preferredExists;

  if (!preferredExists && legacyExists) {
    rootAbsolute = legacyRoot;
    rootRelative = LEGACY_CAPABILITY_DIR;
    variant = "legacy";
    rootExists = true;
  }

  const capabilityPath = (suffix?: string): CapabilityPathInfo => {
    const relative = buildRelative(rootRelative, suffix);
    const absolute = resolve(rootAbsolute, suffix ?? ".");
    return {
      relative,
      absolute,
      variant,
      exists: existsSync(absolute),
    };
  };

  return {
    root: {
      relative: rootRelative,
      absolute: rootAbsolute,
      variant,
      exists: rootExists,
    },
    capabilitiesDir: capabilityPath("capabilities"),
    autoDir: capabilityPath("auto"),
    registryFile: {
      relative: buildRelative(rootRelative, "registry.ts"),
      absolute: resolve(rootAbsolute, "registry.ts"),
      variant,
      exists: existsSync(resolve(rootAbsolute, "registry.ts")),
    },
    legacyRootExists: legacyExists,
  };
}

export function formatLegacyWarning(): string {
  return `Legacy capability directory (\\"${LEGACY_CAPABILITY_DIR}\\") detected. Rename to \"${PREFERRED_CAPABILITY_DIR}\" to avoid bare-import collisions with the \"ai-capabilities\" npm package.`;
}
