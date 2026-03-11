// ---------------------------------------------------------------------------
// Trace layer: type definitions
// ---------------------------------------------------------------------------

/**
 * Processing stage that produced the trace event.
 */
export type TraceStage = "extract" | "enrich" | "adapter" | "runtime" | "policy";

/**
 * Severity level of a trace event.
 */
export type TraceLevel = "info" | "warning" | "error";

/**
 * A single structured trace event.
 *
 * Represents one chronological point in the processing pipeline.
 * Serialized as one line in a JSONL trace file.
 */
export interface TraceEvent {
  /** Unique ID for the entire trace (one pipeline run / request). */
  traceId: string;
  /** Optional session ID for future user-session scoping. */
  sessionId?: string;
  /** Optional request-level correlation ID. */
  requestId?: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Which processing stage produced this event. */
  stage: TraceStage;
  /** Free-form event type within the stage (e.g. "extractor.started"). */
  eventType: string;
  /** Severity level. */
  level: TraceLevel;
  /** Capability this event relates to, if any. */
  capabilityId?: string;
  /** Human-readable description. */
  message: string;
  /** Structured payload (kept small — no large schemas or secrets). */
  data?: Record<string, unknown>;
}

/**
 * Minimal writer interface for appending trace events.
 *
 * Implementations:
 *  - FileTraceWriter  — appends to a JSONL file on disk
 *  - NoopTraceWriter   — silent no-op (tracing disabled)
 */
export interface TraceWriter {
  write(event: TraceEvent): Promise<void>;
}

/**
 * Filter criteria for reading / listing trace events.
 */
export interface TraceFilter {
  traceId?: string;
  stage?: TraceStage;
  level?: TraceLevel;
  capabilityId?: string;
}
