// ---------------------------------------------------------------------------
// Trace layer: storage path helpers (browser-safe)
// ---------------------------------------------------------------------------

function joinPath(...segments: Array<string | undefined>): string {
  const filtered = segments.filter((s): s is string => Boolean(s));
  const startsWithSlash = filtered[0]?.startsWith("/") ?? false;
  const joined = filtered
    .map((s) => s.replace(/(^\/+|\/+$)/g, ""))
    .join("/")
    .replace(/\/\/+/g, "/");
  return startsWithSlash ? `/${joined}` : joined;
}

/**
 * Build the JSONL file path for a given trace.
 *
 * Layout: `<tracesDir>/YYYY-MM-DD/<traceId>.jsonl`
 */
export function traceFilePath(tracesDir: string, traceId: string, date?: Date): string {
  const d = date ?? new Date();
  const day = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return joinPath(tracesDir, day, `${traceId}.jsonl`);
}

/**
 * Extract the date folder name from a Date.
 */
export function traceDateFolder(date?: Date): string {
  const d = date ?? new Date();
  return d.toISOString().slice(0, 10);
}
