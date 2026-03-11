import { resolve } from "node:path";
import type { ResolvedConfig } from "../config/types.js";

/**
 * Minimal ResolvedConfig stub for unit tests.
 */
export function createTestConfig(projectPath: string): ResolvedConfig {
  const outDir = resolve(projectPath, "__test-output__");
  return {
    filePath: resolve(projectPath, "ai-capabilities.config.json"),
    dir: projectPath,
    project: {
      root: projectPath,
      tsconfig: undefined,
    },
    paths: {
      include: ["**/*"],
      exclude: [],
    },
    extractors: {
      openapi: {
        spec: [],
      },
      reactQuery: {
        include: [],
        exclude: [],
        tsconfig: undefined,
      },
      router: {
        include: [],
        exclude: [],
      },
      form: {
        include: [],
        exclude: [],
      },
    },
    output: {
      raw: resolve(outDir, "capabilities.raw.json"),
      enriched: resolve(outDir, "capabilities.enriched.json"),
      diagnostics: resolve(outDir, "diagnostics.log"),
      canonical: resolve(outDir, "ai-capabilities.json"),
      public: resolve(outDir, "ai-capabilities.public.json"),
      tracesDir: resolve(outDir, "traces"),
    },
    schema: {
      maxDepth: 5,
      resolveRefs: true,
    },
    policy: {
      overrides: {},
    },
    manifest: {
      app: {
        name: "Test App",
      },
      defaults: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
    },
  };
}
