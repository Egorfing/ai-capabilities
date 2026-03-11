import { describe, it, expect } from "vitest";
import { buildInspectSummary } from "./inspect-summary.js";
import { createInspectLoadFixture } from "./inspect-test-helpers.js";

describe("inspect summary", () => {
  const loadResult = createInspectLoadFixture();

  it("computes metrics and warnings", () => {
    const summary = buildInspectSummary(loadResult);
    expect(summary.metrics.totalAll).toBe(loadResult.manifest.capabilities.length);
    expect(summary.metrics.executable).toBe(2);
    expect(summary.metrics.unbound).toBe(1);
    expect(summary.metrics.publicCount).toBeGreaterThan(0);
    expect(summary.warnings).toContain("Custom wrapper not supported");
  });

  it("applies public and kind filters", () => {
    const summary = buildInspectSummary(loadResult, { publicOnly: true, kind: "read" });
    expect(summary.capabilities.length).toBe(1);
    expect(summary.capabilities[0]!.capability.id).toBe("orders.status.get");
    expect(summary.metrics.total).toBe(1);
  });

  it("filters unbound-only capabilities", () => {
    const summary = buildInspectSummary(loadResult, { unboundOnly: true });
    expect(summary.capabilities).toHaveLength(1);
    expect(summary.capabilities[0]!.capability.id).toBe("reports.export");
    expect(summary.metrics.executable).toBe(0);
    expect(summary.metrics.unbound).toBe(1);
  });
});
