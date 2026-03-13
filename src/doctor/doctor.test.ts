import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "./run-doctor.js";
import { formatDoctorReportJson } from "./doctor-printer.js";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "ai-doctor-"));
}

describe("runDoctor", () => {
  it("reports missing config", async () => {
    const dir = tempDir();
    const report = await runDoctor({ cwd: dir });
    expect(report.status).toBe("not_initialized");
    expect(report.configOk).toBe(false);
    expect(report.issues.some((issue) => issue.code === "CONFIG_MISSING")).toBe(true);
  });

  it("flags missing canonical manifest", async () => {
    const dir = tempDir();
    writeConfig(dir);
    const report = await runDoctor({ cwd: dir });
    expect(report.status).toBe("initialized");
    expect(report.outputChecks.canonical?.exists).toBe(false);
    expect(report.issues.some((issue) => issue.code === "CANONICAL_MANIFEST_MISSING")).toBe(true);
  });

  it("summarizes capabilities and produces JSON", async () => {
    const dir = tempDir();
    writeConfig(dir);
    const outputDir = join(dir, "output");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "capabilities.raw.json"), JSON.stringify({}));
    writeFileSync(join(outputDir, "ai-capabilities.json"), JSON.stringify(sampleManifest()));
    writeFileSync(join(outputDir, "ai-capabilities.public.json"), JSON.stringify(sampleManifest()));
    writeFileSync(join(outputDir, "ai-capabilities.enriched.json"), JSON.stringify({}));
    writeFileSync(join(outputDir, "diagnostics.log"), "ok");
    mkdirSync(join(outputDir, "traces"), { recursive: true });
    mkdirSync(join(dir, "src/ai-capabilities/capabilities"), { recursive: true });
    writeFileSync(join(dir, "src/ai-capabilities/registry.ts"), "export {};");
    writeFileSync(join(dir, "src/ai-capabilities/capabilities/exampleCapability.ts"), "export {};");

    const report = await runDoctor({ cwd: dir });
    expect(report.status).toBe("pilot_ready");
    expect(report.capabilityStats?.total).toBe(2);
    expect(report.capabilityStats?.executable).toBe(1);
    expect(report.capabilityStats?.unbound).toBe(1);
    const json = JSON.parse(formatDoctorReportJson(report));
    expect(json.status).toBe("pilot_ready");
    expect(json.outputChecks.canonical.exists).toBe(true);
  });
});

function writeConfig(dir: string) {
  const config = {
    project: { root: "." },
    output: {
      raw: "./output/capabilities.raw.json",
      canonical: "./output/ai-capabilities.json",
      public: "./output/ai-capabilities.public.json",
      enriched: "./output/ai-capabilities.enriched.json",
      diagnostics: "./output/diagnostics.log",
      tracesDir: "./output/traces",
    },
  };
  writeFileSync(join(dir, "ai-capabilities.config.json"), JSON.stringify(config, null, 2));
}

function sampleManifest() {
  return {
    manifestVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    app: { name: "Doctor Test" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities: [
      {
        id: "api.projects.list",
        kind: "read",
        displayTitle: "List projects",
        description: "List projects",
        userDescription: "List all projects",
        aliases: ["list projects"],
        exampleIntents: ["Show my projects"],
        inputSchema: {
          type: "object",
          properties: {},
        },
        policy: {
          visibility: "public",
          riskLevel: "low",
          confirmationPolicy: "none",
        },
        execution: {
          mode: "http",
          endpoint: {
            method: "GET",
            path: "/projects",
          },
        },
        sources: [{ type: "manual" }],
      },
      {
        id: "api.projects.delete",
        kind: "mutation",
        displayTitle: "Delete project",
        description: "Delete project",
        userDescription: "Delete a project",
        aliases: ["remove project"],
        exampleIntents: ["Delete project 123"],
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
        policy: {
          visibility: "internal",
          riskLevel: "high",
          confirmationPolicy: "once",
        },
        sources: [{ type: "manual" }],
      },
    ],
  };
}
