import { describe, it, expect } from "vitest";
import { normalizeCapabilitySchemas } from "./schema-normalizer.js";
import type { RawCapability, JsonSchema, DiagnosticEntry } from "../types/index.js";

function makeCapability(schema: JsonSchema): RawCapability {
  return {
    id: "cap.test",
    source: { type: "openapi" },
    kind: "read",
    inputSchema: schema,
    metadata: {},
  };
}

describe("normalizeCapabilitySchemas", () => {
  it("resolves $ref pointers when enabled", async () => {
    const cap = makeCapability({
      definitions: {
        Input: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
      $ref: "#/definitions/Input",
    });

    const diagnostics: DiagnosticEntry[] = [];
    await normalizeCapabilitySchemas([cap], { maxDepth: 5, resolveRefs: true }, diagnostics);

    expect(cap.inputSchema).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    });
    expect(diagnostics).toHaveLength(0);
  });

  it("keeps $ref when resolver disabled", async () => {
    const cap = makeCapability({
      properties: {
        foo: { $ref: "#/definitions/Foo" },
      },
      definitions: {
        Foo: { type: "string" },
      },
    });

    const diagnostics: DiagnosticEntry[] = [];
    await normalizeCapabilitySchemas([cap], { maxDepth: 5, resolveRefs: false }, diagnostics);

    const props = cap.inputSchema.properties as Record<string, any>;
    expect(props.foo.$ref).toBe("#/definitions/Foo");
    expect(diagnostics).toHaveLength(0);
  });

  it("limits schema depth and records diagnostic", async () => {
    const cap = makeCapability({
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: {
            inner: { type: "string" },
          },
        },
      },
    });
    const diagnostics: DiagnosticEntry[] = [];

    await normalizeCapabilitySchemas([cap], { maxDepth: 1, resolveRefs: true }, diagnostics);

    expect(diagnostics.some((d) => d.message.includes("Truncated input schema"))).toBe(true);
    expect(cap.inputSchema).toMatchObject({
      type: "object",
      properties: {
        nested: {
          type: "object",
          description: "Truncated schema",
        },
      },
    });
  });

  it("produces canonical ordering for properties and arrays", async () => {
    const cap = makeCapability({
      required: ["beta", "alpha", "beta"],
      properties: {
        beta: { type: "string" },
        alpha: { type: "string", enum: ["z", "a", "z"] },
      },
    });
    const diagnostics: DiagnosticEntry[] = [];

    await normalizeCapabilitySchemas([cap], { maxDepth: 5, resolveRefs: true }, diagnostics);

    const props = cap.inputSchema.properties as Record<string, any>;
    expect(Object.keys(props)).toEqual(["alpha", "beta"]);
    expect(cap.inputSchema.required).toEqual(["alpha", "beta"]);
    expect(props.alpha.enum).toEqual(["a", "z"]);
  });
});
