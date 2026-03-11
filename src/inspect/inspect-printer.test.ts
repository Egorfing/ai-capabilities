import { describe, it, expect } from "vitest";
import { buildInspectSummary } from "./inspect-summary.js";
import { formatInspectSummaryOutput } from "./inspect-printer.js";
import { createInspectLoadFixture } from "./inspect-test-helpers.js";

describe("inspect printer", () => {
  it("renders readable summary", () => {
    const loadResult = createInspectLoadFixture();
    const summary = buildInspectSummary(loadResult);
    const output = formatInspectSummaryOutput(summary);
    expect(output).toContain("# Test App — Inspect");
    expect(output).toContain("Found 3 capabilities");
    expect(output).toContain("## Mutations");
    expect(output).toContain("## Public capabilities");
    expect(output).toContain("Unsupported patterns");
  });

  it("shows empty state when filters remove all capabilities", () => {
    const loadResult = createInspectLoadFixture();
    const summary = buildInspectSummary(loadResult, { kind: "navigation" });
    const output = formatInspectSummaryOutput(summary);
    expect(output).toContain("No capabilities matched the selected filters");
  });
});
