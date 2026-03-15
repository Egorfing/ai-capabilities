// ---------------------------------------------------------------------------
// Trace ID helpers (browser-safe)
// ---------------------------------------------------------------------------

/**
 * Generate a short, reasonably unique trace ID.
 *
 * Format: base36 timestamp + random suffix (e.g. "m1abc2-x7k9f2").
 * No Node.js-only dependencies so it can be used in browser bundles.
 */
export function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}
