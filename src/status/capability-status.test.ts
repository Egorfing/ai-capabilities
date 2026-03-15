import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { analyzeCapabilityStatus } from "./capability-status.js";

const FIXTURE = resolve(import.meta.dirname, "../../fixtures/status/basic");

describe("analyzeCapabilityStatus", () => {
  it("computes lifecycle flags for fixtures", () => {
    const report = analyzeCapabilityStatus({ cwd: FIXTURE });
    console.log(report.rows);
    const rows = Object.fromEntries(report.rows.map((row) => [row.id, row]));

    expect(rows["cap.placeholder"]).toMatchObject({
      scaffolded: "yes",
      authored: "no",
      registered: "no",
    });

    expect(rows["cap.authored"]).toMatchObject({
      scaffolded: "yes",
      authored: "yes",
      registered: "yes",
      executable: "yes",
    });

    expect(rows["cap.manifestOnly"]).toMatchObject({
      scaffolded: "no",
      authored: "unknown",
      registered: "no",
      executable: "no",
    });
  });
});
