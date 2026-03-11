import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AiCapabilitiesConfig,
  ResolvedConfig,
  GlobPattern,
  PolicyOverrides,
} from "./types.js";

const DEFAULT_FILENAMES = ["ai-capabilities.config.ts", "ai-capabilities.config.json"];

export interface LoadConfigOptions {
  /** Explicit config path (relative to cwd allowed). */
  configPath?: string;
  /** Base directory to search (defaults to process.cwd()). */
  cwd?: string;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<ResolvedConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolveConfigPath(options.configPath, cwd);
  const raw = await readRawConfig(configPath);
  return normalizeConfig(raw ?? {}, configPath);
}

function resolveConfigPath(explicitPath: string | undefined, cwd: string): string {
  if (explicitPath) {
    const abs = isAbsolute(explicitPath) ? explicitPath : resolve(cwd, explicitPath);
    if (!existsSync(abs)) {
      throw new Error(
        `Config file not found at ${abs}. Provide a valid path with --config.`,
      );
    }
    return abs;
  }

  for (const name of DEFAULT_FILENAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Cannot find config file. Looked for ${DEFAULT_FILENAMES.join(", ")} in ${cwd}.`,
  );
}

async function readRawConfig(filePath: string): Promise<AiCapabilitiesConfig | undefined> {
  if (filePath.endsWith(".json")) {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as AiCapabilitiesConfig;
  }

  if (filePath.endsWith(".ts") || filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
    const mod = await import(pathToFileURL(filePath).href);
    const config = (mod?.default ?? mod) as AiCapabilitiesConfig | undefined;
    if (!config || typeof config !== "object") {
      throw new Error(`Config module ${filePath} does not export an object.`);
    }
    return config;
  }

  throw new Error(
    `Unsupported config extension for ${filePath}. Use .json or .ts (ESM).`,
  );
}

function normalizeConfig(raw: AiCapabilitiesConfig, filePath: string): ResolvedConfig {
  const dir = dirname(filePath);
  const projectRoot = resolvePath(raw.project?.root ?? ".", dir);
  const tsconfig =
    raw.project?.tsconfig !== undefined
      ? resolvePath(raw.project.tsconfig, dir)
      : defaultTsconfig(projectRoot);

  const includePatterns = normalizePatterns(raw.paths?.include ?? ["**/*"]);
  const excludePatterns = normalizePatterns(
    raw.paths?.exclude ?? [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      ".turbo/**",
      "coverage/**",
    ],
  );

  const openapiSpec = toArray(raw.extractors?.openapi?.spec).map((spec) =>
    resolvePath(spec, dir),
  );

  const reactInclude = normalizePatterns(
    raw.extractors?.reactQuery?.include ?? [],
  );
  const reactExclude = normalizePatterns(
    raw.extractors?.reactQuery?.exclude ?? [],
  );
  const reactTsconfig = raw.extractors?.reactQuery?.tsconfig
    ? resolvePath(raw.extractors.reactQuery.tsconfig, dir)
    : undefined;

  const routerInclude = normalizePatterns(raw.extractors?.router?.include ?? []);
  const routerExclude = normalizePatterns(raw.extractors?.router?.exclude ?? []);
  const formInclude = normalizePatterns(raw.extractors?.form?.include ?? []);
  const formExclude = normalizePatterns(raw.extractors?.form?.exclude ?? []);

  const outputRaw = resolvePath(raw.output?.raw ?? "./output/capabilities.raw.json", dir);
  const outputEnriched = resolvePath(
    raw.output?.enriched ?? "./output/capabilities.enriched.json",
    dir,
  );
  const outputDiagnostics = resolvePath(
    raw.output?.diagnostics ?? "./output/diagnostics.log",
    dir,
  );
  const outputCanonical = resolvePath(
    raw.output?.canonical ?? "./output/ai-capabilities.json",
    dir,
  );
  const outputPublic = resolvePath(
    raw.output?.public ?? "./output/ai-capabilities.public.json",
    dir,
  );
  const outputTracesDir = resolvePath(
    raw.output?.tracesDir ?? "./output/traces",
    dir,
  );

  const schemaMaxDepth = Number(raw.schema?.maxDepth ?? 5);
  const schemaResolveRefs =
    raw.schema?.resolveRefs !== undefined ? Boolean(raw.schema.resolveRefs) : true;

  const overrides: PolicyOverrides = raw.policy?.overrides ?? {};

  const manifestApp = {
    name: raw.manifest?.app?.name ?? "App",
    version: raw.manifest?.app?.version,
    description: raw.manifest?.app?.description,
    baseUrl: raw.manifest?.app?.baseUrl,
  };
  const manifestDefaults = {
    visibility: raw.manifest?.defaults?.visibility ?? "internal",
    riskLevel: raw.manifest?.defaults?.riskLevel ?? "low",
    confirmationPolicy: raw.manifest?.defaults?.confirmationPolicy ?? "none",
  };

  return {
    filePath,
    dir,
    project: {
      root: projectRoot,
      tsconfig,
    },
    paths: {
      include: includePatterns,
      exclude: excludePatterns,
    },
    extractors: {
      openapi: {
        spec: openapiSpec,
      },
      reactQuery: {
        include: reactInclude,
        exclude: reactExclude,
        tsconfig: reactTsconfig,
      },
      router: {
        include: routerInclude,
        exclude: routerExclude,
      },
      form: {
        include: formInclude,
        exclude: formExclude,
      },
    },
    output: {
      raw: outputRaw,
      enriched: outputEnriched,
      diagnostics: outputDiagnostics,
      canonical: outputCanonical,
      public: outputPublic,
      tracesDir: outputTracesDir,
    },
    schema: {
      maxDepth: Number.isFinite(schemaMaxDepth) ? Math.max(1, schemaMaxDepth) : 5,
      resolveRefs: schemaResolveRefs,
    },
    policy: {
      overrides,
    },
    manifest: {
      app: manifestApp,
      defaults: manifestDefaults,
    },
  };
}

function resolvePath(target: string, baseDir: string): string {
  if (!target) return baseDir;
  return isAbsolute(target) ? target : resolve(baseDir, target);
}

function normalizePatterns(patterns: GlobPattern[]): GlobPattern[] {
  return patterns
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => normalizePattern(p));
}

function normalizePattern(pattern: string): string {
  return pattern.replace(/\\/g, "/").replace(/^\.\//, "");
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function defaultTsconfig(projectRoot: string): string | undefined {
  const candidate = resolve(projectRoot, "tsconfig.json");
  return existsSync(candidate) ? candidate : undefined;
}
