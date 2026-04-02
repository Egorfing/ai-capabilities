import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { VERSION } from "./index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("capability-engine", () => {
  it("exports a version string matching package.json", () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
