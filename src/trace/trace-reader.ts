// ---------------------------------------------------------------------------
// Trace layer: reader + filtering
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TraceEvent, TraceFilter } from "./trace-types.js";

/**
 * Parse a single JSONL trace file into an array of TraceEvents.
 */
export function readTraceFile(filePath: string): TraceEvent[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  const events: TraceEvent[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as TraceEvent);
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}

/**
 * Read all trace files from a traces directory.
 *
 * Scans `<tracesDir>/YYYY-MM-DD/*.jsonl` and returns all events
 * sorted by timestamp (ascending).
 */
export function readTraceDir(tracesDir: string): TraceEvent[] {
  if (!existsSync(tracesDir)) return [];

  const events: TraceEvent[] = [];

  const dateDirs = readdirSync(tracesDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();

  for (const dateDir of dateDirs) {
    const dirPath = join(tracesDir, dateDir);
    if (!statSync(dirPath).isDirectory()) continue;

    const files = readdirSync(dirPath)
      .filter((f) => f.endsWith(".jsonl"))
      .sort();

    for (const file of files) {
      const filePath = join(dirPath, file);
      events.push(...readTraceFile(filePath));
    }
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return events;
}

/**
 * Apply a filter to a list of trace events.
 */
export function filterTraceEvents(events: TraceEvent[], filter: TraceFilter): TraceEvent[] {
  return events.filter((event) => {
    if (filter.traceId && event.traceId !== filter.traceId) return false;
    if (filter.stage && event.stage !== filter.stage) return false;
    if (filter.level && event.level !== filter.level) return false;
    if (filter.capabilityId && event.capabilityId !== filter.capabilityId) return false;
    return true;
  });
}

/**
 * List all unique trace IDs found in a traces directory.
 */
export function listTraceIds(tracesDir: string): string[] {
  if (!existsSync(tracesDir)) return [];

  const ids = new Set<string>();
  const dateDirs = readdirSync(tracesDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();

  for (const dateDir of dateDirs) {
    const dirPath = join(tracesDir, dateDir);
    if (!statSync(dirPath).isDirectory()) continue;

    for (const file of readdirSync(dirPath)) {
      if (file.endsWith(".jsonl")) {
        ids.add(file.replace(/\.jsonl$/, ""));
      }
    }
  }

  return Array.from(ids).sort();
}
