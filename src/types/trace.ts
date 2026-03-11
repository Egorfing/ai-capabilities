// ---------------------------------------------------------------------------
// Domain model: Trace / observability events
// ---------------------------------------------------------------------------

export type TraceEventKind =
  | "extraction:start"
  | "extraction:end"
  | "enrichment:start"
  | "enrichment:end"
  | "execution:start"
  | "execution:end"
  | "policy:check"
  | "policy:denied"
  | "error"
  | "warning";

/** A single structured log entry in the system trace. */
export interface TraceEvent {
  traceId: string;
  sessionId?: string;
  requestId?: string;
  timestamp: string;
  kind: TraceEventKind;
  capabilityId?: string;
  message: string;
  data?: Record<string, unknown>;
}
