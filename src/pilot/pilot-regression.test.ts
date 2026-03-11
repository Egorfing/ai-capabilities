import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPilot } from "./run-pilot.js";
import { DEMO_APP_PATH, DEMO_CONFIG_PATH, goldenPath, readGoldenJson, projectRoot } from "../test-helpers/fixtures.js";
import { normalizeForSnapshot, normalizeTextSnapshot } from "../test-helpers/snapshots.js";
import type { AiCapabilitiesConfig } from "../config/types.js";

describe("pilot regression — demo app", () => {
  it("produces golden pilot report and summary", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "pilot-reg-"));
    try {
      const artifactsDir = join(tempDir, "artifacts");
      const reportDir = join(tempDir, "reports");
      mkdirSync(artifactsDir, { recursive: true });
      mkdirSync(reportDir, { recursive: true });

      const baseConfig = JSON.parse(readFileSync(DEMO_CONFIG_PATH, "utf-8")) as AiCapabilitiesConfig;
      baseConfig.project = {
        root: DEMO_APP_PATH,
        tsconfig: projectRoot("tsconfig.json"),
      };
      baseConfig.extractors ??= {};
      if (baseConfig.extractors.openapi) {
        baseConfig.extractors.openapi.spec = [join(DEMO_APP_PATH, "openapi.json")];
      }
      if (baseConfig.extractors.reactQuery?.tsconfig) {
        baseConfig.extractors.reactQuery.tsconfig = projectRoot("tsconfig.json");
      }
      baseConfig.output = {
        raw: join(artifactsDir, "capabilities.raw.json"),
        enriched: join(artifactsDir, "capabilities.enriched.json"),
        diagnostics: join(artifactsDir, "diagnostics.log"),
        canonical: join(artifactsDir, "ai-capabilities.json"),
        public: join(artifactsDir, "ai-capabilities.public.json"),
        tracesDir: join(artifactsDir, "traces"),
      };

      const configPath = join(tempDir, "ai-capabilities.config.json");
      writeFileSync(configPath, JSON.stringify(baseConfig, null, 2));

      const result = await runPilot({
        projectPath: DEMO_APP_PATH,
        configPath,
        reportDir,
        withEnrich: true,
      });

      expect(result.report.status).toBe("success");
      const actualReport = JSON.parse(readFileSync(result.reportPath, "utf-8"));
      const expectedReport = readGoldenJson("demo-app", "pilot-report.json");
      expect(
        normalizeForSnapshot(actualReport, { dropKeys: ["artifacts", "configPath"] }),
      ).toEqual(normalizeForSnapshot(expectedReport, { dropKeys: ["artifacts", "configPath"] }));
      expect(actualReport.configPath).toMatch(/ai-capabilities\.config\.json$/);
      expect(actualReport.artifacts.rawManifest).toMatch(/capabilities\.raw\.json$/);
      expect(actualReport.artifacts.canonicalManifest).toMatch(/ai-capabilities\.json$/);

      const actualSummary = readFileSync(result.summaryPath, "utf-8");
      const expectedSummary = readFileSync(goldenPath("demo-app", "pilot-summary.md"), "utf-8");
      expect(normalizeTextSnapshot(actualSummary)).toEqual(normalizeTextSnapshot(expectedSummary));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 60_000);
});
