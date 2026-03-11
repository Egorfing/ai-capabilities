// ---------------------------------------------------------------------------
// Trace layer: convenience factories for creating TraceEvents
// ---------------------------------------------------------------------------

import type { TraceEvent, TraceStage, TraceLevel } from "./trace-types.js";

/**
 * Create a TraceEvent with sensible defaults.
 */
export function createTraceEvent(
  traceId: string,
  stage: TraceStage,
  eventType: string,
  message: string,
  opts?: {
    level?: TraceLevel;
    capabilityId?: string;
    requestId?: string;
    sessionId?: string;
    data?: Record<string, unknown>;
  },
): TraceEvent {
  return {
    traceId,
    sessionId: opts?.sessionId,
    requestId: opts?.requestId,
    timestamp: new Date().toISOString(),
    stage,
    eventType,
    level: opts?.level ?? "info",
    capabilityId: opts?.capabilityId,
    message,
    data: opts?.data,
  };
}

/**
 * Shorthand for an extraction-stage trace event.
 */
export function extractionEvent(
  traceId: string,
  eventType: string,
  message: string,
  opts?: { level?: TraceLevel; capabilityId?: string; data?: Record<string, unknown> },
): TraceEvent {
  return createTraceEvent(traceId, "extract", eventType, message, opts);
}

/**
 * Shorthand for an enrichment-stage trace event.
 */
export function enrichmentEvent(
  traceId: string,
  eventType: string,
  message: string,
  opts?: { level?: TraceLevel; capabilityId?: string; data?: Record<string, unknown> },
): TraceEvent {
  return createTraceEvent(traceId, "enrich", eventType, message, opts);
}

/**
 * Shorthand for a runtime-stage trace event.
 */
export function runtimeEvent(
  traceId: string,
  eventType: string,
  message: string,
  opts?: {
    level?: TraceLevel;
    capabilityId?: string;
    requestId?: string;
    data?: Record<string, unknown>;
  },
): TraceEvent {
  return createTraceEvent(traceId, "runtime", eventType, message, opts);
}

/**
 * Shorthand for a policy-stage trace event.
 */
export function policyEvent(
  traceId: string,
  eventType: string,
  message: string,
  opts?: {
    level?: TraceLevel;
    capabilityId?: string;
    requestId?: string;
    data?: Record<string, unknown>;
  },
): TraceEvent {
  return createTraceEvent(traceId, "policy", eventType, message, opts);
}
