import { describe, it, expect } from "vitest";
import { ExtractorRegistry } from "./registry.js";
import { runPipeline } from "./pipeline.js";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.js";
import { createTestConfig } from "../test-helpers/config.js";
import type { DiagnosticEntry } from "../types/index.js";

function diag(level: DiagnosticEntry["level"], message: string): DiagnosticEntry {
  return {
    level,
    stage: "extraction",
    sourceType: "custom",
    message,
  };
}

function makeExtractor(
  name: string,
  result: Partial<ExtractionResult> = {},
): Extractor {
  return {
    name,
    sourceType: "custom",
    async extract(_ctx: ExtractionContext): Promise<ExtractionResult> {
      return {
        extractor: name,
        capabilities: result.capabilities ?? [],
        diagnostics: result.diagnostics ?? [],
      };
    },
  };
}

function failingExtractor(name: string, error: string): Extractor {
  return {
    name,
    sourceType: "custom",
    async extract(): Promise<ExtractionResult> {
      throw new Error(error);
    },
  };
}

const ctx: ExtractionContext = {
  projectPath: "/tmp/test-project",
  config: createTestConfig("/tmp/test-project"),
};

describe("ExtractorRegistry", () => {
  it("registers and retrieves extractors", () => {
    const reg = new ExtractorRegistry();
    const ext = makeExtractor("test");
    reg.register(ext);
    expect(reg.get("test")).toBe(ext);
    expect(reg.names()).toEqual(["test"]);
  });

  it("throws on duplicate registration", () => {
    const reg = new ExtractorRegistry();
    reg.register(makeExtractor("dup"));
    expect(() => reg.register(makeExtractor("dup"))).toThrow("already registered");
  });

  it("returns all extractors", () => {
    const reg = new ExtractorRegistry();
    reg.register(makeExtractor("a"));
    reg.register(makeExtractor("b"));
    expect(reg.getAll()).toHaveLength(2);
  });
});

describe("runPipeline", () => {
  it("returns warning when no extractors registered", async () => {
    const reg = new ExtractorRegistry();
    const result = await runPipeline(reg, ctx);
    expect(result.capabilities).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].level).toBe("warning");
  });

  it("merges capabilities from multiple extractors", async () => {
    const reg = new ExtractorRegistry();
    reg.register(
      makeExtractor("ext-a", {
        capabilities: [
          {
            id: "cap.a",
            source: { type: "custom" },
            kind: "read",
            inputSchema: {},
            metadata: {},
          },
        ],
      }),
    );
    reg.register(
      makeExtractor("ext-b", {
        capabilities: [
          {
            id: "cap.b",
            source: { type: "custom" },
            kind: "mutation",
            inputSchema: {},
            metadata: {},
          },
        ],
      }),
    );

    const result = await runPipeline(reg, ctx);
    expect(result.capabilities).toHaveLength(2);
    expect(result.capabilities.map((c) => c.id)).toEqual(["cap.a", "cap.b"]);
    expect(result.extractorsRun).toEqual(["ext-a", "ext-b"]);
  });

  it("collects diagnostics from all extractors", async () => {
    const reg = new ExtractorRegistry();
    reg.register(
      makeExtractor("ext-a", {
        diagnostics: [diag("info", "found 1 file")],
      }),
    );
    reg.register(
      makeExtractor("ext-b", {
        diagnostics: [diag("warning", "skipped pattern")],
      }),
    );

    const result = await runPipeline(reg, ctx);
    expect(result.diagnostics).toHaveLength(2);
  });

  it("catches extractor errors without stopping pipeline", async () => {
    const reg = new ExtractorRegistry();
    reg.register(failingExtractor("broken", "parser crash"));
    reg.register(
      makeExtractor("ok", {
        capabilities: [
          {
            id: "cap.ok",
            source: { type: "custom" },
            kind: "read",
            inputSchema: {},
            metadata: {},
          },
        ],
      }),
    );

    const result = await runPipeline(reg, ctx);
    expect(result.capabilities).toHaveLength(1);
    expect(result.capabilities[0].id).toBe("cap.ok");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].level).toBe("error");
    expect(result.diagnostics[0].message).toBe("parser crash");
    expect(result.extractorsRun).toEqual(["broken", "ok"]);
  });

  it("filters extractors by source type", async () => {
    const reg = new ExtractorRegistry();
    const openapi: Extractor = {
      name: "openapi",
      sourceType: "openapi",
      async extract() {
        return { extractor: "openapi", capabilities: [{ id: "api.x", source: { type: "openapi" }, kind: "read", inputSchema: {}, metadata: {} }], diagnostics: [] };
      },
    };
    const router: Extractor = {
      name: "router",
      sourceType: "router",
      async extract() {
        return { extractor: "router", capabilities: [{ id: "nav.x", source: { type: "router" }, kind: "navigation", inputSchema: {}, metadata: {} }], diagnostics: [] };
      },
    };
    reg.register(openapi);
    reg.register(router);

    const result = await runPipeline(reg, ctx, { only: ["openapi"] });
    expect(result.capabilities).toHaveLength(1);
    expect(result.capabilities[0].id).toBe("api.x");
    expect(result.extractorsRun).toEqual(["openapi"]);
  });

  it("normalizes capability schemas according to config", async () => {
    const reg = new ExtractorRegistry();
    reg.register(
      makeExtractor("norm", {
        capabilities: [
          {
            id: "cap.deep",
            source: { type: "custom" },
            kind: "read",
            inputSchema: {
              type: "object",
              properties: {
                nested: {
                  type: "object",
                  properties: {
                    inner: { type: "string" },
                  },
                },
              },
            },
            metadata: {},
          },
        ],
      }),
    );
    const config = createTestConfig("/tmp/test-project");
    config.schema.maxDepth = 1;
    const customCtx: ExtractionContext = {
      ...ctx,
      config,
    };

    const result = await runPipeline(reg, customCtx);

    expect(
      (result.capabilities[0].inputSchema as any).properties.nested,
    ).toMatchObject({ type: "object", description: "Truncated schema" });
    expect(result.diagnostics.some((d) => d.message.includes("Truncated input schema"))).toBe(true);
  });
});
