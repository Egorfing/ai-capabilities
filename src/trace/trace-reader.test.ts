import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readTraceFile, readTraceDir, filterTraceEvents, listTraceIds } from "./trace-reader.js";
import type { TraceEvent } from "./trace-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `trace-reader-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    traceId: "trace-1",
    timestamp: "2026-03-10T10:00:00.000Z",
    stage: "runtime",
    eventType: "test.event",
    level: "info",
    message: "Test event",
    ...overrides,
  };
}

function writeJsonl(filePath: string, events: TraceEvent[]): void {
  const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
  mkdirSync(dirPath, { recursive: true });
  const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(filePath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// readTraceFile
// ---------------------------------------------------------------------------

describe("readTraceFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("parses valid JSONL file", () => {
    const filePath = join(tempDir, "test.jsonl");
    const events = [
      makeEvent({ message: "First" }),
      makeEvent({ message: "Second", level: "warning" }),
    ];
    writeJsonl(filePath, events);

    const result = readTraceFile(filePath);
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe("First");
    expect(result[1].level).toBe("warning");
  });

  it("returns empty array for non-existent file", () => {
    const result = readTraceFile(join(tempDir, "nope.jsonl"));
    expect(result).toEqual([]);
  });

  it("skips malformed lines", () => {
    const filePath = join(tempDir, "bad.jsonl");
    const content = JSON.stringify(makeEvent()) + "\nnot-json\n" + JSON.stringify(makeEvent({ message: "good" })) + "\n";
    writeFileSync(filePath, content, "utf-8");

    const result = readTraceFile(filePath);
    expect(result).toHaveLength(2);
  });

  it("handles empty file", () => {
    const filePath = join(tempDir, "empty.jsonl");
    writeFileSync(filePath, "", "utf-8");

    const result = readTraceFile(filePath);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// readTraceDir
// ---------------------------------------------------------------------------

describe("readTraceDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads events from date-partitioned directories", () => {
    writeJsonl(join(tempDir, "2026-03-09", "trace-a.jsonl"), [
      makeEvent({ traceId: "trace-a", timestamp: "2026-03-09T12:00:00.000Z" }),
    ]);
    writeJsonl(join(tempDir, "2026-03-10", "trace-b.jsonl"), [
      makeEvent({ traceId: "trace-b", timestamp: "2026-03-10T08:00:00.000Z" }),
      makeEvent({ traceId: "trace-b", timestamp: "2026-03-10T09:00:00.000Z" }),
    ]);

    const events = readTraceDir(tempDir);
    expect(events).toHaveLength(3);
    // Sorted by timestamp
    expect(events[0].traceId).toBe("trace-a");
    expect(events[1].traceId).toBe("trace-b");
  });

  it("returns empty for non-existent directory", () => {
    const events = readTraceDir(join(tempDir, "nope"));
    expect(events).toEqual([]);
  });

  it("ignores non-date directories", () => {
    writeJsonl(join(tempDir, "not-a-date", "trace.jsonl"), [makeEvent()]);
    writeJsonl(join(tempDir, "2026-03-10", "trace.jsonl"), [makeEvent()]);

    const events = readTraceDir(tempDir);
    expect(events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// filterTraceEvents
// ---------------------------------------------------------------------------

describe("filterTraceEvents", () => {
  const events: TraceEvent[] = [
    makeEvent({ traceId: "t1", stage: "extract", level: "info", capabilityId: "orders.create" }),
    makeEvent({ traceId: "t1", stage: "runtime", level: "warning", capabilityId: "orders.create" }),
    makeEvent({ traceId: "t2", stage: "runtime", level: "error", capabilityId: "users.list" }),
    makeEvent({ traceId: "t2", stage: "policy", level: "warning" }),
  ];

  it("filters by traceId", () => {
    const result = filterTraceEvents(events, { traceId: "t1" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.traceId === "t1")).toBe(true);
  });

  it("filters by stage", () => {
    const result = filterTraceEvents(events, { stage: "runtime" });
    expect(result).toHaveLength(2);
  });

  it("filters by level", () => {
    const result = filterTraceEvents(events, { level: "warning" });
    expect(result).toHaveLength(2);
  });

  it("filters by capabilityId", () => {
    const result = filterTraceEvents(events, { capabilityId: "orders.create" });
    expect(result).toHaveLength(2);
  });

  it("combines multiple filters", () => {
    const result = filterTraceEvents(events, { traceId: "t1", stage: "runtime" });
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe("warning");
  });

  it("returns all events with empty filter", () => {
    const result = filterTraceEvents(events, {});
    expect(result).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// listTraceIds
// ---------------------------------------------------------------------------

describe("listTraceIds", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns unique trace IDs from directory", () => {
    writeJsonl(join(tempDir, "2026-03-10", "alpha.jsonl"), [makeEvent()]);
    writeJsonl(join(tempDir, "2026-03-10", "beta.jsonl"), [makeEvent()]);
    writeJsonl(join(tempDir, "2026-03-11", "gamma.jsonl"), [makeEvent()]);

    const ids = listTraceIds(tempDir);
    expect(ids).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns empty for non-existent directory", () => {
    const ids = listTraceIds(join(tempDir, "nope"));
    expect(ids).toEqual([]);
  });
});
