// ---------------------------------------------------------------------------
// Trace layer: storage path helpers + ID generation
// ---------------------------------------------------------------------------

import { join } from "node:path";

/**
 * Generate a short, reasonably unique trace ID.
 *
 * Format: base36 timestamp + random suffix (e.g. "m1abc2-x7k9f2").
 * No external deps — suitable for single-process use.
 */
export function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

/**
 * Build the JSONL file path for a given trace.
 *
 * Layout: `<tracesDir>/YYYY-MM-DD/<traceId>.jsonl`
 */
export function traceFilePath(tracesDir: string, traceId: string, date?: Date): string {
  const d = date ?? new Date();
  const day = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return join(tracesDir, day, `${traceId}.jsonl`);
}

/**
 * Extract the date folder name from a Date.
 */
export function traceDateFolder(date?: Date): string {
  const d = date ?? new Date();
  return d.toISOString().slice(0, 10);
}
