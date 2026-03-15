// ---------------------------------------------------------------------------
// Trace layer: public API
// ---------------------------------------------------------------------------

// Types
export type {
  TraceEvent,
  TraceStage,
  TraceLevel,
  TraceWriter,
  TraceFilter,
} from "./trace-types.js";

// Store / IDs
export { generateTraceId } from "./trace-id.js";
export { traceFilePath, traceDateFolder } from "./trace-store.js";

// Writer implementations
export {
  FileTraceWriter,
  NoopTraceWriter,
  createTraceWriter,
} from "./trace-writer.js";
export type { CreateTraceWriterOptions } from "./trace-writer.js";

// Reader
export {
  readTraceFile,
  readTraceDir,
  filterTraceEvents,
  listTraceIds,
} from "./trace-reader.js";

// Event factories
export {
  createTraceEvent,
  extractionEvent,
  enrichmentEvent,
  runtimeEvent,
  policyEvent,
} from "./trace-utils.js";
