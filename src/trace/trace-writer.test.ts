import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileTraceWriter, NoopTraceWriter, createTraceWriter } from "./trace-writer.js";
import type { TraceEvent } from "./trace-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `trace-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    traceId: "test-trace-1",
    timestamp: "2026-03-10T10:00:00.000Z",
    stage: "runtime",
    eventType: "test.event",
    level: "info",
    message: "Test event",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FileTraceWriter
// ---------------------------------------------------------------------------

describe("FileTraceWriter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes events as JSONL to the trace file", async () => {
    const writer = new FileTraceWriter(tempDir, "test-trace-1");
    const event1 = makeEvent({ message: "First event" });
    const event2 = makeEvent({ message: "Second event", level: "warning" });

    await writer.write(event1);
    await writer.write(event2);

    const filePath = writer.getFilePath();
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const parsed1 = JSON.parse(lines[0]) as TraceEvent;
    expect(parsed1.message).toBe("First event");
    expect(parsed1.stage).toBe("runtime");

    const parsed2 = JSON.parse(lines[1]) as TraceEvent;
    expect(parsed2.message).toBe("Second event");
    expect(parsed2.level).toBe("warning");
  });

  it("creates directories lazily", async () => {
    const nestedDir = join(tempDir, "nested", "deep");
    const writer = new FileTraceWriter(nestedDir, "lazy-test");

    await writer.write(makeEvent());

    const filePath = writer.getFilePath();
    expect(existsSync(filePath)).toBe(true);
  });

  it("uses date-partitioned path layout", () => {
    const writer = new FileTraceWriter(tempDir, "partition-test");
    const filePath = writer.getFilePath();

    // Path should contain YYYY-MM-DD directory
    expect(filePath).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(filePath).toMatch(/partition-test\.jsonl$/);
  });

  it("appends to the same file across multiple writes", async () => {
    const writer = new FileTraceWriter(tempDir, "append-test");

    for (let i = 0; i < 5; i++) {
      await writer.write(makeEvent({ message: `Event ${i}` }));
    }

    const content = readFileSync(writer.getFilePath(), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// NoopTraceWriter
// ---------------------------------------------------------------------------

describe("NoopTraceWriter", () => {
  it("does not throw on write", async () => {
    const writer = new NoopTraceWriter();
    await expect(writer.write(makeEvent())).resolves.toBeUndefined();
  });

  it("accepts multiple writes silently", async () => {
    const writer = new NoopTraceWriter();
    for (let i = 0; i < 10; i++) {
      await writer.write(makeEvent());
    }
    // No file created, no error
  });
});

// ---------------------------------------------------------------------------
// createTraceWriter factory
// ---------------------------------------------------------------------------

describe("createTraceWriter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns FileTraceWriter when tracesDir is provided", async () => {
    const { writer, traceId } = createTraceWriter({ tracesDir: tempDir });
    expect(writer).toBeInstanceOf(FileTraceWriter);
    expect(traceId).toBeTruthy();

    await writer.write(makeEvent({ traceId }));
    // File should exist
    const filePath = (writer as FileTraceWriter).getFilePath();
    expect(existsSync(filePath)).toBe(true);
  });

  it("returns NoopTraceWriter when tracesDir is not provided", () => {
    const { writer, traceId } = createTraceWriter({});
    expect(writer).toBeInstanceOf(NoopTraceWriter);
    expect(traceId).toBeTruthy();
  });

  it("uses custom traceId when provided", () => {
    const { traceId } = createTraceWriter({ tracesDir: tempDir, traceId: "custom-id" });
    expect(traceId).toBe("custom-id");
  });
});
