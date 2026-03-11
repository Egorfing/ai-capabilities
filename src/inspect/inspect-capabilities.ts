import { resolve } from "node:path";
import { loadConfig } from "../config/load-config.js";
import { runPipeline, defaultRegistry } from "../extractors/index.js";
import { mergeCapabilities } from "../merge/merge-capabilities.js";
import { buildAiCapabilitiesManifest } from "../manifest/build-manifest.js";
import type { ResolvedConfig } from "../config/types.js";
import type { InspectCommandOptions, InspectLoadResult } from "./inspect-types.js";

export async function runInspectPipeline(options: InspectCommandOptions = {}): Promise<InspectLoadResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig({
    configPath: options.configPath,
    cwd,
  });

  const projectPath = options.projectPath
    ? resolve(cwd, options.projectPath)
    : config.project.root;

  const finalConfig: ResolvedConfig = {
    ...config,
    project: {
      ...config.project,
      root: projectPath,
    },
  };

  const pipelineResult = await runPipeline(defaultRegistry, { projectPath, config: finalConfig });
  const mergeResult = mergeCapabilities(pipelineResult.capabilities);
  const { canonical, publicManifest } = buildAiCapabilitiesManifest({
    capabilities: mergeResult.capabilities,
    config: finalConfig,
  });

  return {
    projectPath,
    config: finalConfig,
    manifest: canonical,
    publicManifest,
    diagnostics: pipelineResult.diagnostics,
    extractorsRun: pipelineResult.extractorsRun,
  };
}
