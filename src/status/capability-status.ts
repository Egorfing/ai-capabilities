import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import type { AiCapabilitiesManifest } from "../types/index.js";
import { resolveCapabilityDirs } from "../utils/capability-dirs.js";

export type LifecycleFlag = "yes" | "no" | "unknown";

export interface CapabilityLifecycleRow {
  id: string;
  discovered: LifecycleFlag;
  scaffolded: LifecycleFlag;
  authored: LifecycleFlag;
  registered: LifecycleFlag;
  wired: LifecycleFlag;
  executable: LifecycleFlag;
  notes: string[];
}

export interface CapabilityLifecycleSummary {
  discovered: number;
  scaffolded: number;
  authored: number;
  registered: number;
  wired: number;
  executable: number;
}

export interface CapabilityStatusReport {
  summary: CapabilityLifecycleSummary;
  rows: CapabilityLifecycleRow[];
  runtimeDetected: boolean;
}

interface AnalyzeOptions {
  cwd: string;
  manifestPath?: string;
}

interface CapabilityFileEntry {
  filePath: string;
  hasTodo: boolean;
  hasDefineHelper: boolean;
  exportName?: string;
}

export function analyzeCapabilityStatus(options: AnalyzeOptions): CapabilityStatusReport {
  const cwd = options.cwd;
  const manifestPath = resolve(cwd, options.manifestPath ?? "output/ai-capabilities.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Manifest not found at ${manifestPath}. Run "npx ai-capabilities extract" first.`,
    );
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as AiCapabilitiesManifest;
  const capabilityIds = manifest.capabilities.map((cap) => cap.id);

  const capabilityFileIndex = buildCapabilityFileIndex(cwd);
  const registryContent = readRegistryContent(cwd);
  const runtimeDetected = detectRuntimeUsage(cwd);

  const rows: CapabilityLifecycleRow[] = [];
  const summary: CapabilityLifecycleSummary = {
    discovered: 0,
    scaffolded: 0,
    authored: 0,
    registered: 0,
    wired: 0,
    executable: 0,
  };

  for (const id of capabilityIds) {
    const notes: string[] = [];
    const entry = capabilityFileIndex.get(id);
    const row: CapabilityLifecycleRow = {
      id,
      discovered: "yes",
      scaffolded: deriveScaffoldStatus(id, capabilityFileIndex, notes),
      authored: deriveAuthoredStatus(id, capabilityFileIndex, notes),
      registered: deriveRegisteredStatus(id, registryContent, notes, entry),
      wired: runtimeDetected ? "yes" : "unknown",
      executable: "unknown",
      notes,
    };

    summary.discovered += 1;
    if (row.scaffolded === "yes") summary.scaffolded += 1;
    if (row.authored === "yes") summary.authored += 1;
    if (row.registered === "yes") summary.registered += 1;
    if (row.wired === "yes") summary.wired += 1;

    row.executable = deriveExecutableStatus(row, runtimeDetected);
    if (row.executable === "yes") summary.executable += 1;

    rows.push(row);
  }

  return { summary, rows, runtimeDetected };
}

function buildCapabilityFileIndex(cwd: string): Map<string, CapabilityFileEntry> {
  const index = new Map<string, CapabilityFileEntry>();
  const { capabilitiesDir } = resolveCapabilityDirs(cwd);
  if (!capabilitiesDir.exists) return index;
  const files = collectTsFiles(capabilitiesDir.absolute);
  const idPattern = /id\s*:\s*["'`]([^"'`]+)["'`]/g;
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const hasTodo = /throw new Error\(["']TODO/i.test(content);
    const hasDefine = /defineCapability/gi.test(content);
    let match: RegExpExecArray | null;
    while ((match = idPattern.exec(content)) !== null) {
      const id = match[1];
      if (!id) continue;
      const exportMatch = /export\\s+const\\s+(\\w+)/.exec(content);
      index.set(id, {
        filePath: file,
        hasTodo,
        hasDefineHelper: hasDefine,
        exportName: exportMatch ? exportMatch[1] : undefined,
      });
    }
  }
  return index;
}

function collectTsFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectTsFiles(full));
      continue;
    }
    if (entry.isFile() && extname(entry.name) === ".ts") {
      result.push(full);
    }
  }
  return result;
}

function readRegistryContent(cwd: string): string | undefined {
  const { registryFile } = resolveCapabilityDirs(cwd);
  if (!registryFile.exists) return undefined;
  return readFileSync(registryFile.absolute, "utf-8");
}

function detectRuntimeUsage(cwd: string): boolean {
  const srcDir = resolve(cwd, "src");
  if (!existsSync(srcDir)) return false;
  const files = collectTsFiles(srcDir);
  const pattern = /new\s+CapabilityRuntime\s*\(/;
  return files.some((file) => pattern.test(readFileSync(file, "utf-8")));
}

function deriveScaffoldStatus(
  id: string,
  index: Map<string, CapabilityFileEntry>,
  notes: string[],
): LifecycleFlag {
  if (!index.has(id)) return "no";
  return "yes";
}

function deriveAuthoredStatus(
  id: string,
  index: Map<string, CapabilityFileEntry>,
  notes: string[],
): LifecycleFlag {
  const entry = index.get(id);
  if (!entry) return "unknown";
  if (!entry.hasDefineHelper) return "unknown";
  if (entry.hasTodo) {
    notes.push("Handler TODO placeholder detected");
    return "no";
  }
  return "yes";
}

function deriveRegisteredStatus(
  id: string,
  registryContent: string | undefined,
  notes: string[],
  entry?: CapabilityFileEntry,
): LifecycleFlag {
  if (!registryContent) return "unknown";
  if (entry?.exportName && registryContent.includes(entry.exportName)) {
    return "yes";
  }
  if (registryContent.includes(id)) {
    return "yes";
  }
  notes.push("Not found in registry.ts");
  return "no";
}

function deriveExecutableStatus(
  row: CapabilityLifecycleRow,
  runtimeDetected: boolean,
): LifecycleFlag {
  if (row.authored === "yes" && row.registered === "yes" && runtimeDetected) {
    return "yes";
  }
  if (row.authored === "unknown" || row.registered === "unknown" || row.wired === "unknown") {
    return "unknown";
  }
  return "no";
}
