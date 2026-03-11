import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleHealth, handleCapabilities, handleExecute, handleTraces } from "./routes.js";
import type { RouteContext, ServerState } from "./server-types.js";
import { HttpError } from "./server-types.js";
import type { AiCapabilitiesManifest } from "../types/index.js";
import type { CapabilityRuntimeInterface, ExecutionMode } from "../runtime/runtime-types.js";
import { createTraceWriter, runtimeEvent } from "../trace/index.js";

function buildManifest(): AiCapabilitiesManifest {
  return {
    manifestVersion: "1.0.0",
    generatedAt: "2026-03-11T00:00:00.000Z",
    app: { name: "Test App" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities: [
      {
        id: "orders.create",
        kind: "mutation",
        displayTitle: "Create order",
        description: "Create order",
        inputSchema: {
          type: "object",
          properties: { orderId: { type: "string" } },
          required: ["orderId"],
        },
        policy: {
          visibility: "internal",
          riskLevel: "low",
          confirmationPolicy: "none",
        },
        tags: [],
        sources: [{ type: "openapi" }],
        metadata: {},
      },
      {
        id: "orders.status",
        kind: "read",
        displayTitle: "Order status",
        description: "Check status",
        inputSchema: {
          type: "object",
          properties: {},
        },
        policy: {
          visibility: "public",
          riskLevel: "low",
          confirmationPolicy: "none",
        },
        tags: [],
        sources: [{ type: "openapi" }],
        metadata: {},
      },
    ],
  };
}

interface ContextResult {
  ctx: RouteContext;
  runtimeExecute: ReturnType<typeof vi.fn>;
  state: ServerState;
}

async function createContext(options: {
  method: string;
  path: string;
  body?: unknown;
  mode?: ExecutionMode;
  manifest?: AiCapabilitiesManifest;
  runtimeImpl?: CapabilityRuntimeInterface["execute"];
  tracesDir?: string;
}): Promise<ContextResult> {
  const manifest = options.manifest ?? buildManifest();
  const publicManifest = {
    ...manifest,
    capabilities: manifest.capabilities.filter((cap) => cap.policy.visibility === "public"),
  };

  const defaultExecute: CapabilityRuntimeInterface["execute"] = async () => ({
    capabilityId: manifest.capabilities[0].id,
    status: "success",
    data: { ok: true },
  });

  const runtimeExecute = vi.fn(options.runtimeImpl ?? defaultExecute);
  const runtime: CapabilityRuntimeInterface = { execute: runtimeExecute };

  const state: ServerState = {
    manifest,
    publicManifest,
    runtime,
    mode: options.mode ?? "internal",
    tracesDir: options.tracesDir,
    logger: console,
  };

  const stream = new PassThrough();
  if (options.body !== undefined) {
    const payload = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    stream.end(payload);
  } else {
    stream.end();
  }
  const req = Object.assign(stream, {
    method: options.method,
    headers: { "content-type": "application/json" },
  });
  const ctx: RouteContext = {
    req: req as any,
    url: new URL(options.path, "http://test"),
    state,
    traceId: "test-trace",
    recordEvent: async () => {},
  };

  return { ctx, runtimeExecute, state };
}

describe("HTTP route handlers", () => {
  it("GET /health", async () => {
    const { ctx } = await createContext({ method: "GET", path: "/health" });
    const result = await handleHealth(ctx);
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe("success");
    if (result.body.status !== "success") throw new Error("expected success");
    const data = result.body.data as any;
    expect(data.status).toBe("ok");
  });

  it("GET /capabilities returns manifest", async () => {
    const { ctx, state } = await createContext({ method: "GET", path: "/capabilities" });
    const result = await handleCapabilities(ctx);
    expect(result.statusCode).toBe(200);
    if (result.body.status !== "success") throw new Error("expected success");
    const data = result.body.data as any;
    expect(data.capabilities).toHaveLength(state.manifest.capabilities.length);
  });

  it("GET /capabilities filters by id", async () => {
    const { ctx } = await createContext({ method: "GET", path: "/capabilities?capabilityId=orders.status" });
    const result = await handleCapabilities(ctx);
    if (result.body.status !== "success") throw new Error("expected success");
    const data = result.body.data as any;
    expect(data.capabilities).toHaveLength(1);
    expect(data.capabilities[0].id).toBe("orders.status");
  });

  it("POST /execute delegates to runtime", async () => {
    const { ctx, runtimeExecute } = await createContext({
      method: "POST",
      path: "/execute",
      body: { capabilityId: "orders.create", input: { orderId: "1" } },
    });
    const result = await handleExecute(ctx);
    expect(result.statusCode).toBe(200);
    expect(runtimeExecute).toHaveBeenCalledTimes(1);
    const [request, options] = runtimeExecute.mock.calls[0];
    expect(request.capabilityId).toBe("orders.create");
    expect(options.mode).toBe("internal");
    expect(result.body.status).toBe("success");
  });

  it("maps pending result to 409", async () => {
    const { ctx } = await createContext({
      method: "POST",
      path: "/execute",
      body: { capabilityId: "orders.create", input: { orderId: "9" } },
      runtimeImpl: async () => ({
        capabilityId: "orders.create",
        status: "pending",
        error: { code: "POLICY_CONFIRMATION_REQUIRED", message: "Need confirm" },
      }),
    });
    const result = await handleExecute(ctx);
    expect(result.statusCode).toBe(409);
    if (result.body.status !== "error") throw new Error("expected error");
    expect(result.body.error.code).toBe("POLICY_CONFIRMATION_REQUIRED");
  });

  it("enforces public mode restrictions", async () => {
    const privateCtxResult = await createContext({
      method: "POST",
      path: "/execute",
      mode: "public",
      body: { capabilityId: "orders.create", input: { orderId: "1" } },
    });
    await expect(handleExecute(privateCtxResult.ctx)).rejects.toBeInstanceOf(HttpError);

    const publicCtx = await createContext({
      method: "POST",
      path: "/execute",
      mode: "public",
      body: { capabilityId: "orders.status", input: {} },
    });
    const result = await handleExecute(publicCtx.ctx);
    expect(result.statusCode).toBe(200);
    const [, options] = publicCtx.runtimeExecute.mock.calls[0];
    expect(options.mode).toBe("public");
  });

  describe("GET /traces", () => {
    let tracesDir: string;

    beforeEach(() => {
      tracesDir = mkdtempSync(join(tmpdir(), "cap-server-traces-"));
    });

    afterEach(() => {
      rmSync(tracesDir, { recursive: true, force: true });
    });

    it("returns stored events", async () => {
      const traceId = "trace-test";
      const { writer } = createTraceWriter({ tracesDir, traceId });
      await writer.write(runtimeEvent(traceId, "runtime.event", "Test", { data: { foo: "bar" } }));
      const { ctx } = await createContext({ method: "GET", path: "/traces?stage=runtime", tracesDir });
      const result = await handleTraces(ctx);
      expect(result.statusCode).toBe(200);
      if (result.body.status !== "success") throw new Error("expected success");
      const data = result.body.data as any;
      expect(data.items.length).toBe(1);
      expect(data.items[0].message).toBe("Test");
    });
  });
});
