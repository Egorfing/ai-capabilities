// ---------------------------------------------------------------------------
// Trace layer: writer implementations
// ---------------------------------------------------------------------------

import { mkdirSync, appendFileSync, statSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import type { TraceEvent, TraceWriter } from "./trace-types.js";
import { traceFilePath } from "./trace-store.js";
import { generateTraceId } from "./trace-id.js";

// ---- FileTraceWriter ------------------------------------------------------

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_FILES = 5;

/**
 * Appends trace events as JSONL to a date-partitioned file.
 *
 * File layout: `<tracesDir>/YYYY-MM-DD/<traceId>.jsonl`
 *
 * Directories are created lazily on first write.
 * Supports automatic file rotation when size exceeds `maxFileSizeBytes`.
 */
export class FileTraceWriter implements TraceWriter {
  private readonly tracesDir: string;
  private dirCreated = false;
  private filePath: string | undefined;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;

  constructor(
    tracesDir: string,
    private readonly traceId: string,
    options?: { maxFileSizeBytes?: number; maxFiles?: number },
  ) {
    this.tracesDir = tracesDir;
    this.maxFileSizeBytes = options?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  }

  async write(event: TraceEvent): Promise<void> {
    if (!this.filePath) {
      this.filePath = traceFilePath(this.tracesDir, this.traceId);
    }
    if (!this.dirCreated) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      this.dirCreated = true;
    }

    // Rotate if file exceeds size limit
    if (this.maxFileSizeBytes > 0) {
      try {
        const stat = statSync(this.filePath);
        if (stat.size >= this.maxFileSizeBytes) {
          this.rotate();
        }
      } catch {
        // File doesn't exist yet — no rotation needed
      }
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

  private rotate(): void {
    if (!this.filePath) return;
    const dir = dirname(this.filePath);
    const base = this.filePath;

    // Shift existing rotated files: .2 → .3, .1 → .2, etc.
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const from = `${base}.${i}`;
      const to = `${base}.${i + 1}`;
      try {
        if (i + 1 >= this.maxFiles) {
          unlinkSync(from); // Delete oldest beyond maxFiles
        } else {
          renameSync(from, to);
        }
      } catch {
        // File doesn't exist — skip
      }
    }

    // Current → .1
    try {
      renameSync(base, `${base}.1`);
    } catch {
      // ignore
    }
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
