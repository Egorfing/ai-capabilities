// ---------------------------------------------------------------------------
// Configuration types for ai-capabilities.config.{json,ts}
// ---------------------------------------------------------------------------

import type { Visibility, RiskLevel, ConfirmationPolicy } from "../types/index.js";

export type GlobPattern = string;

export interface ProjectConfig {
  /** Root of the project we introspect (relative to config file by default). */
  root?: string;
  /** Optional explicit tsconfig path. */
  tsconfig?: string;
}

export interface PathsConfig {
  include?: GlobPattern[];
  exclude?: GlobPattern[];
}

export interface OpenApiExtractorConfig {
  /** One or many spec files (json/yaml). */
  spec?: string | string[];
}

export interface ReactQueryExtractorConfig {
  /** Override include/exclude just for this extractor. */
  include?: GlobPattern[];
  exclude?: GlobPattern[];
  /** Use dedicated tsconfig if needed. */
  tsconfig?: string;
}

export interface RouterExtractorConfig {
  include?: GlobPattern[];
  exclude?: GlobPattern[];
}

export interface FormExtractorConfig {
  include?: GlobPattern[];
  exclude?: GlobPattern[];
}

export interface SchemaConfig {
  maxDepth?: number;
  resolveRefs?: boolean;
}

export interface ExtractorsConfig {
  openapi?: OpenApiExtractorConfig;
  reactQuery?: ReactQueryExtractorConfig;
  router?: RouterExtractorConfig;
  form?: FormExtractorConfig;
  // Future extractors can extend this bag without changing loader.
  [key: string]: unknown;
}

export interface OutputConfig {
  raw?: string;
  enriched?: string;
  diagnostics?: string;
  canonical?: string;
  public?: string;
  tracesDir?: string;
}

export interface PolicyOverrides {
  [capabilityId: string]: {
    visibility?: Visibility;
    riskLevel?: RiskLevel;
    confirmationPolicy?: ConfirmationPolicy;
    tags?: string[];
    permissionScope?: string[];
    [key: string]: unknown;
  };
}

export interface ManifestAppInfo {
  name?: string;
  version?: string;
  description?: string;
  baseUrl?: string;
}

export interface ManifestDefaults {
  visibility?: Visibility;
  riskLevel?: RiskLevel;
  confirmationPolicy?: ConfirmationPolicy;
}

export interface ManifestConfig {
  app?: ManifestAppInfo;
  defaults?: ManifestDefaults;
}

export interface AiCapabilitiesConfig {
  project?: ProjectConfig;
  paths?: PathsConfig;
  extractors?: ExtractorsConfig;
  output?: OutputConfig;
  schema?: SchemaConfig;
  policy?: {
    overrides?: PolicyOverrides;
  };
  manifest?: ManifestConfig;
}

export interface ResolvedConfig {
  /** Absolute path to the config file. */
  filePath: string;
  /** Directory containing the config file. */
  dir: string;
  project: {
    /** Absolute path to project root. */
    root: string;
    /** Absolute path to tsconfig, if provided. */
    tsconfig?: string;
  };
  paths: {
    include: GlobPattern[];
    exclude: GlobPattern[];
  };
  extractors: {
    openapi: {
      spec: string[];
    };
    reactQuery: {
      include: GlobPattern[];
      exclude: GlobPattern[];
      tsconfig?: string;
    };
    router: {
      include: GlobPattern[];
      exclude: GlobPattern[];
    };
    form: {
      include: GlobPattern[];
      exclude: GlobPattern[];
    };
    [key: string]: unknown;
  };
  output: {
    raw: string;
    enriched: string;
    diagnostics: string;
    canonical: string;
    public: string;
    tracesDir: string;
  };
  schema: {
    maxDepth: number;
    resolveRefs: boolean;
  };
  policy: {
    overrides: PolicyOverrides;
  };
  manifest: {
    app: Required<Pick<ManifestAppInfo, "name">> & Partial<ManifestAppInfo>;
    defaults: Required<ManifestDefaults>;
  };
}
