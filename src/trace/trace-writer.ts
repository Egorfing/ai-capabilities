// ---------------------------------------------------------------------------
// Trace layer: writer implementations
// ---------------------------------------------------------------------------

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import type { TraceEvent, TraceWriter } from "./trace-types.js";
import { traceFilePath } from "./trace-store.js";
import { generateTraceId } from "./trace-id.js";

// ---- FileTraceWriter ------------------------------------------------------

/**
 * Appends trace events as JSONL to a date-partitioned file.
 *
 * File layout: `<tracesDir>/YYYY-MM-DD/<traceId>.jsonl`
 *
 * Directories are created lazily on first write.
 */
export class FileTraceWriter implements TraceWriter {
  private readonly tracesDir: string;
  private dirCreated = false;
  private filePath: string | undefined;

  constructor(tracesDir: string, private readonly traceId: string) {
    this.tracesDir = tracesDir;
  }

  async write(event: TraceEvent): Promise<void> {
    if (!this.filePath) {
      this.filePath = traceFilePath(this.tracesDir, this.traceId);
    }
    if (!this.dirCreated) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      this.dirCreated = true;
    }
    const line = JSON.stringify(event) + "\n";
    appendFileSync(this.filePath, line, "utf-8");
  }

  /** Returns the resolved file path (available after construction). */
  getFilePath(): string {
    if (!this.filePath) {
      this.filePath = traceFilePath(this.tracesDir, this.traceId);
    }
    return this.filePath;
  }
}

// ---- NoopTraceWriter ------------------------------------------------------

/**
 * Silent no-op writer.  Used when tracing is disabled.
 */
export class NoopTraceWriter implements TraceWriter {
  async write(_event: TraceEvent): Promise<void> {
    // intentionally empty
  }
}

// ---- Factory --------------------------------------------------------------

export interface CreateTraceWriterOptions {
  /** Traces output directory. If falsy, returns NoopTraceWriter. */
  tracesDir?: string;
  /** Trace ID for this run.  Auto-generated if omitted. */
  traceId?: string;
}

/**
 * Create a TraceWriter.
 *
 * Returns a FileTraceWriter when `tracesDir` is given, NoopTraceWriter otherwise.
 */
export function createTraceWriter(
  options: CreateTraceWriterOptions,
): { writer: TraceWriter; traceId: string } {
  const traceId = options.traceId ?? generateTraceId();

  if (!options.tracesDir) {
    return { writer: new NoopTraceWriter(), traceId };
  }

  return { writer: new FileTraceWriter(options.tracesDir, traceId), traceId };
}
