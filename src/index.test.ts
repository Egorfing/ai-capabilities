import { describe, it, expect } from "vitest";
import { VERSION } from "./index.js";

describe("capability-engine", () => {
  it("exports a version string", () => {
    expect(VERSION).toBe("0.2.0");
  });
});
