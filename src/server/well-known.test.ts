import { describe, it, expect, vi } from "vitest";
import { PassThrough } from "node:stream";
import type { RouteContext, ServerState } from "./server-types.js";
import { handleWellKnown } from "./routes.js";
import type { AiCapabilitiesManifest } from "../types/index.js";
import type { CapabilityRuntimeInterface } from "../runtime/runtime-types.js";
import { readGoldenJson } from "../test-helpers/fixtures.js";
import { normalizeForSnapshot } from "../test-helpers/snapshots.js";
import { buildWellKnownResponse } from "../well-known/index.js";

function buildManifest(): AiCapabilitiesManifest {
  return {
    manifestVersion: "1.0.0",
    generatedAt: "2026-03-11T00:00:00.000Z",
    app: { name: "Demo App", version: "0.2.1", description: "Demo" },
    defaults: {
      visibility: "internal",
      riskLevel: "medium",
      confirmationPolicy: "once",
    },
    capabilities: [
      {
        id: "orders.create",
        kind: "mutation",
        displayTitle: "Create Order",
        description: "Creates orders",
        userDescription: "Create an order",
        aliases: ["create order"],
        exampleIntents: ["Create an order for customer Foo"],
        inputSchema: { type: "object", properties: { id: { type: "string" } } },
        policy: {
          visibility: "public",
          riskLevel: "medium",
          confirmationPolicy: "once",
        },
        execution: {
          mode: "http",
          handlerRef: "orders.create",
          endpoint: { method: "POST", path: "/execute" },
        },
        tags: ["orders"],
        sources: [{ type: "openapi" }],
        metadata: { internal: true },
      },
      {
        id: "orders.internalAudit",
        kind: "read",
        displayTitle: "Audit",
        description: "Internal only",
        inputSchema: { type: "object" },
        policy: {
          visibility: "internal",
          riskLevel: "high",
          confirmationPolicy: "none",
        },
        sources: [{ type: "openapi" }],
      },
    ],
  };
}

function createContext(manifest: AiCapabilitiesManifest): RouteContext {
  const runtime: CapabilityRuntimeInterface = {
    execute: vi.fn(),
  };
  const state: ServerState = {
    manifest,
    publicManifest: undefined,
    runtime,
    mode: "internal",
    tracesDir: undefined,
    logger: console,
  };
  const stream = new PassThrough();
  stream.end();
  const req = Object.assign(stream, { method: "GET", headers: {} });
  return {
    req: req as any,
    url: new URL("/.well-known/ai-capabilities.json", "http://test"),
    state,
    traceId: "test-trace",
    recordEvent: vi.fn(async () => {}),
  };
}

describe("handleWellKnown", () => {
  it("returns only public capabilities with sanitized fields", async () => {
    const manifest = buildManifest();
    const ctx = createContext(manifest);
    const result = await handleWellKnown(ctx);
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe("success");
    if (result.body.status !== "success") throw new Error("expected success");
    const body = result.body.data as any;
    expect(body.capabilities).toHaveLength(1);
    const capability = body.capabilities[0];
    expect(capability.id).toBe("orders.create");
    expect(capability).not.toHaveProperty("sources");
    expect(capability).not.toHaveProperty("metadata");
    expect(capability.execution?.endpoint?.path).toBe("/execute");
    expect(body.discovery.executionEndpoint.path).toBe("/execute");
  });

  it("handles empty public manifest", async () => {
    const manifest = buildManifest();
    manifest.capabilities = manifest.capabilities.filter((cap) => cap.policy.visibility !== "public");
    const ctx = createContext(manifest);
    const result = await handleWellKnown(ctx);
    expect(result.statusCode).toBe(200);
    if (result.body.status !== "success") throw new Error("expected success");
    const data = result.body.data as any;
    expect(data.capabilities).toHaveLength(0);
  });
});

describe("well-known golden snapshot", () => {
  it("matches fixture response", () => {
    const manifest = readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.public.json");
    const result = buildWellKnownResponse({
      manifest,
      mode: "public",
      executionEndpoint: { method: "POST", path: "/execute" },
      capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
    });
    const expected = readGoldenJson("demo-app", "ai-capabilities.well-known.json");
    expect(normalizeForSnapshot(result)).toEqual(normalizeForSnapshot(expected));
  });
});
