import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".next", "__tests__"]);

export function discoverProjectTsFiles(rootDir: string): string[] {
  const results: string[] = [];
  walk(rootDir, results);
  return results;
}

function walk(dir: string, results: string[]): void {
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
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, results);
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
