import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ResolvedConfig } from "../config/types.js";

export interface CompatibilityResult {
  errors: string[];
  warnings: string[];
}

export function runCompatibilityChecks(config: ResolvedConfig, projectPath: string): CompatibilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(projectPath)) {
    errors.push(`Project path does not exist: ${projectPath}`);
  }

  if (config.project.tsconfig && !existsSync(config.project.tsconfig)) {
    errors.push(`tsconfig not found at ${config.project.tsconfig}`);
  }

  for (const specPath of config.extractors.openapi.spec) {
    if (!existsSync(specPath)) {
      errors.push(`OpenAPI spec missing at ${specPath}`);
    }
  }

  if (config.paths.include.length === 0) {
    warnings.push("paths.include is empty — extractor coverage may be limited");
  }
  if (config.paths.exclude.length === 0) {
    warnings.push("paths.exclude is empty — large scans may be slow");
  }

  ensureDirWritable(config.output.raw, errors);
  ensureDirWritable(config.output.enriched, errors);
  ensureDirWritable(config.output.canonical, errors);
  ensureDirWritable(config.output.public, errors);
  ensureDirWritable(config.output.diagnostics, errors);
  ensureDirWritable(config.output.tracesDir, errors);

  return { errors, warnings };
}

function ensureDirWritable(targetPath: string, errors: string[]): void {
  try {
    mkdirSync(dirname(targetPath), { recursive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Cannot write to ${targetPath}: ${message}`);
  }
}
