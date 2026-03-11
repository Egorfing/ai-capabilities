// ---------------------------------------------------------------------------
// Extractor framework: types
// ---------------------------------------------------------------------------

import type {
  RawCapability,
  SourceType,
  DiagnosticEntry,
  DiagnosticStage,
} from "../types/index.js";
import type { ResolvedConfig } from "../config/types.js";

/** Input context shared by all extractors. */
export interface ExtractionContext {
  /** Absolute path to the project root. */
  projectPath: string;
  /** Fully-resolved configuration. */
  config: ResolvedConfig;
  /** Optional: limit extraction to specific source types. */
  only?: SourceType[];
}

/** Output of a single extractor run. */
export interface ExtractionResult {
  /** Which extractor produced this result. */
  extractor: string;
  capabilities: RawCapability[];
  diagnostics: DiagnosticEntry[];
}

/** Merged output of the full extraction pipeline. */
export interface PipelineResult {
  capabilities: RawCapability[];
  diagnostics: DiagnosticEntry[];
  extractorsRun: string[];
}

/** Interface every extractor must implement. */
export interface Extractor {
  /** Unique name, e.g. "openapi", "react-query". */
  name: string;
  /** The source type this extractor produces. */
  sourceType: SourceType;
  /** Run extraction against the project. */
  extract(ctx: ExtractionContext): Promise<ExtractionResult>;
}

export const EXTRACTION_STAGE: DiagnosticStage = "extraction";
