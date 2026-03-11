import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPilot } from "./run-pilot.js";
import type { ResolvedConfig } from "../config/types.js";
import type { RawCapability, DiagnosticEntry } from "../types/index.js";
import { loadConfig } from "../config/load-config.js";
import { runPipeline } from "../extractors/index.js";
import { runEnrichment } from "../enrich/index.js";

vi.mock("../config/load-config.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../extractors/index.js", () => ({
  defaultRegistry: {},
  runPipeline: vi.fn(),
}));

vi.mock("../enrich/index.js", () => ({
  runEnrichment: vi.fn(),
}));

vi.mock("../trace/index.js", async () => {
  const actual = await vi.importActual<typeof import("../trace/index.js")>("../trace/index.js");
  return {
    ...actual,
    createTraceWriter: vi.fn(() => ({
      writer: { write: vi.fn(async () => {}) },
      traceId: "test-trace",
    })),
  };
});

const loadConfigMock = vi.mocked(loadConfig);
const runPipelineMock = vi.mocked(runPipeline);
const runEnrichmentMock = vi.mocked(runEnrichment);

function createConfig(root: string): ResolvedConfig {
  return {
    filePath: join(root, "ai-capabilities.config.json"),
    dir: root,
    project: {
      root,
      tsconfig: undefined,
    },
    paths: {
      include: ["src/**/*"],
      exclude: ["node_modules/**"],
    },
    extractors: {
      openapi: {
        spec: [],
      },
      reactQuery: {
        include: [],
        exclude: [],
        tsconfig: undefined,
      },
      router: {
        include: [],
        exclude: [],
      },
      form: {
        include: [],
        exclude: [],
      },
    },
    output: {
      raw: join(root, "output", "raw.json"),
      enriched: join(root, "output", "enriched.json"),
      diagnostics: join(root, "output", "diagnostics.log"),
      canonical: join(root, "output", "canonical.json"),
      public: join(root, "output", "public.json"),
      tracesDir: join(root, "output", "traces"),
    },
    schema: {
      maxDepth: 5,
      resolveRefs: true,
    },
    policy: {
      overrides: {},
    },
    manifest: {
      app: {
        name: "Pilot Test App",
      },
      defaults: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
    },
  };
}

function capability(id: string, sourceType: string): RawCapability {
  return {
    id,
    kind: "mutation",
    title: id,
    description: `${id} description`,
    inputSchema: { type: "object" },
    metadata: {},
    source: { type: sourceType as RawCapability["source"]["type"] },
  };
}

function warning(message: string): DiagnosticEntry {
  return {
    level: "warning",
    stage: "extraction",
    message,
    sourceType: "openapi",
  };
}

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pilot-test-"));
  loadConfigMock.mockResolvedValue(createConfig(tempDir));
  runPipelineMock.mockResolvedValue({
    capabilities: [capability("orders.create", "openapi"), capability("orders.cancel", "react-query")],
    diagnostics: [],
    extractorsRun: ["openapi", "react-query"],
  });
  runEnrichmentMock.mockResolvedValue({
    manifest: {
      manifestVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      app: { name: "Pilot Test App" },
      defaults: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      capabilities: [],
    },
    diagnostics: [],
  });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("runPilot", () => {
  it("creates report and summary for a successful run", async () => {
    const result = await runPilot();
    expect(result.report.status).toBe("success");
    expect(existsSync(result.reportPath)).toBe(true);
    expect(existsSync(result.summaryPath)).toBe(true);
    const json = JSON.parse(readFileSync(result.reportPath, "utf-8")) as { summary: { capabilitiesTotal: number } };
    expect(json.summary.capabilitiesTotal).toBe(2);
    expect(runEnrichmentMock).not.toHaveBeenCalled();
  });

  it("runs enrichment and records warnings as partial", async () => {
    runPipelineMock.mockResolvedValue({
      capabilities: [capability("orders.create", "openapi")],
      diagnostics: [warning("Unsupported custom hook pattern")],
      extractorsRun: ["openapi"],
    });
    runEnrichmentMock.mockImplementation(async ({ outputPath }) => {
      writeFileSync(outputPath, JSON.stringify({ ok: true }));
      return {
        manifest: {
          manifestVersion: "1.0.0",
          generatedAt: new Date().toISOString(),
          app: { name: "Pilot Test App" },
          defaults: {
            visibility: "internal",
            riskLevel: "low",
            confirmationPolicy: "none",
          },
          capabilities: [],
        },
        diagnostics: [],
      };
    });

    const result = await runPilot({ withEnrich: true });
    expect(result.report.status).toBe("partial");
    expect(result.report.unsupportedPatterns).toContain("Unsupported custom hook pattern");
    expect(result.report.artifacts.enrichedManifest).toBeDefined();
    expect(runEnrichmentMock).toHaveBeenCalledTimes(1);
  });

  it("fails when project path is missing", async () => {
    const missingDir = join(tempDir, "missing-project");
    loadConfigMock.mockResolvedValue(createConfig(missingDir));
    const result = await runPilot();
    expect(result.report.status).toBe("failed");
    expect(result.report.compatibility.errors.length).toBeGreaterThan(0);
    expect(runPipelineMock).not.toHaveBeenCalled();
  });
});
