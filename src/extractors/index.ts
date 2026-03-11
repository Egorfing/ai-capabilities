export type {
  Extractor,
  ExtractionContext,
  ExtractionResult,
  PipelineResult,
} from "./types.js";
export { EXTRACTION_STAGE } from "./types.js";

export { ExtractorRegistry, defaultRegistry } from "./registry.js";
export { runPipeline } from "./pipeline.js";
export type { PipelineOptions } from "./pipeline.js";
export { openApiExtractor } from "./openapi.js";
export { reactQueryExtractor } from "./react-query.js";
export { routerExtractor } from "./router.js";
export { formExtractor } from "./forms.js";

// Register built-in extractors
import { defaultRegistry } from "./registry.js";
import { openApiExtractor } from "./openapi.js";
import { reactQueryExtractor } from "./react-query.js";
import { routerExtractor } from "./router.js";
import { formExtractor } from "./forms.js";
defaultRegistry.register(openApiExtractor);
defaultRegistry.register(reactQueryExtractor);
defaultRegistry.register(routerExtractor);
defaultRegistry.register(formExtractor);
