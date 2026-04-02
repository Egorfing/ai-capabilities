import { readdirSync, lstatSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".next", "__tests__"]);
const MAX_WALK_DEPTH = 30;

export function discoverProjectTsFiles(rootDir: string): string[] {
  const results: string[] = [];
  const visited = new Set<string>();
  walk(rootDir, results, visited, 0);
  return results;
}

function walk(dir: string, results: string[], visited: Set<string>, depth: number): void {
  if (depth > MAX_WALK_DEPTH) return;

  // Resolve real path to detect symlink cycles
  let realDir: string;
  try {
    realDir = realpathSync(dir);
  } catch {
    return;
  }
  if (visited.has(realDir)) return;
  visited.add(realDir);

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue;
    }
    // Skip symlinks to avoid traversal attacks and infinite loops
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      walk(full, results, visited, depth + 1);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      results.push(full);
    }
  }
}

export function filterFilesByGlob(
  files: string[],
  projectPath: string,
  includePatterns: string[],
  excludePatterns: string[],
): string[] {
  const includeRegex = compilePatterns(includePatterns);
  const excludeRegex = compilePatterns(excludePatterns);

  return files.filter((file) => {
    const rel = normalizeForMatch(relative(projectPath, file)) || ".";
    if (excludeRegex.some((re) => re.test(rel))) return false;
    if (includeRegex.length === 0) return true;
    return includeRegex.some((re) => re.test(rel));
  });
}

function normalizeForMatch(p: string): string {
  return p.replace(/\\/g, "/");
}

function compilePatterns(patterns: string[]): RegExp[] {
  return patterns
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pattern) => globToRegExp(pattern.replace(/^\.\//, "")));
}

function globToRegExp(pattern: string): RegExp {
  let regex = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!;
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        regex += ".*";
        i++;
      } else {
        regex += "[^/]*";
      }
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += char.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
    }
  }
  return new RegExp(`^${regex}$`);
}
