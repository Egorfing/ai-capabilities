import { describe, it, expect, vi } from "vitest";
import { PassThrough } from "node:stream";
import type { JsonResponse } from "./response-builders.js";
import { createAiCapabilitiesMiddleware, type ExpressRequestHandler, type ExpressRequestLike, type ExpressResponseLike } from "./express-middleware.js";
import type { CapabilityRuntimeInterface } from "../runtime/runtime-types.js";
import type { AiCapabilitiesManifest, CapabilityExecutionResult } from "../types/index.js";

describe("createAiCapabilitiesMiddleware", () => {
  it("serves well-known manifest with public capabilities only", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest);
    const handler = createAiCapabilitiesMiddleware({ runtime, manifest, mode: "internal" });

    const result = await invoke(handler, { method: "GET", url: "/.well-known/ai-capabilities.json" });
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(200);
    const payload = expectSuccess(result.payload);
    expect(payload.data.capabilities).toHaveLength(1);
    expect(payload.data.capabilities[0]?.id).toBe("api.orders.list-orders");
  });

  it("filters /capabilities response with query params", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest);
    const handler = createAiCapabilitiesMiddleware({ runtime, manifest });

    const result = await invoke(handler, { method: "GET", url: "/capabilities?visibility=public" });
    const payload = expectSuccess(result.payload);
    expect(payload.data.capabilities).toHaveLength(1);
    expect(payload.data.capabilities[0]?.id).toBe("api.orders.list-orders");
  });

  it("executes capability requests and returns runtime response", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest, async () => ({
      capabilityId: "api.orders.list-orders",
      status: "success",
      data: { items: [] },
    }));
    const handler = createAiCapabilitiesMiddleware({ runtime, manifest });

    const result = await invoke(handler, {
      method: "POST",
      url: "/execute",
      body: { capabilityId: "api.orders.list-orders", input: {} },
    });

    const payload = expectSuccess(result.payload);
    expect(payload.data).toEqual({ items: [] });
    expect(runtime.execute).toHaveBeenCalledTimes(1);
  });

  it("rejects private capabilities in public mode", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest);
    const handler = createAiCapabilitiesMiddleware({ runtime, manifest, mode: "public" });

    const result = await invoke(handler, {
      method: "POST",
      url: "/execute",
      body: { capabilityId: "api.orders.create-order", input: {} },
    });

    expect(result.statusCode).toBe(403);
    const payload = expectError(result.payload);
    expect(payload.error.code).toBe("POLICY_DENIED");
  });

  it("supports manifestProvider callback", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest);
    const handler = createAiCapabilitiesMiddleware({
      runtime,
      manifestProvider: async () => manifest,
    });

    const result = await invoke(handler, {
      method: "POST",
      url: "/execute",
      body: { capabilityId: "api.orders.list-orders", input: {} },
    });

    expect(result.statusCode).toBe(200);
    expect(runtime.execute).toHaveBeenCalledTimes(1);
  });

  it("handles basePath prefixed routes", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest);
    const handler = createAiCapabilitiesMiddleware({
      runtime,
      manifest,
      basePath: "/ai",
    });

    const discovery = await invoke(handler, { method: "GET", url: "/ai/.well-known/ai-capabilities.json" });
    expect(discovery.statusCode).toBe(200);

    const execution = await invoke(handler, {
      method: "POST",
      url: "/ai/execute",
      body: { capabilityId: "api.orders.list-orders", input: {} },
    });
    expect(execution.statusCode).toBe(200);

    const passThrough = await invoke(handler, { method: "GET", url: "/.well-known/ai-capabilities.json" });
    expect(passThrough.nextCalled).toBe(true);
  });

  it("maps runtime errors to structured responses", async () => {
    const manifest = buildManifest();
    const runtime = createRuntime(manifest, async () => {
      throw new Error("boom");
    });
    const handler = createAiCapabilitiesMiddleware({ runtime, manifest });

    const result = await invoke(handler, {
      method: "POST",
      url: "/execute",
      body: { capabilityId: "api.orders.list-orders", input: {} },
    });

    expect(result.statusCode).toBe(500);
    const payload = expectError(result.payload);
    expect(payload.error.code).toBe("RUNTIME_ERROR");
  });
});

function buildManifest(): AiCapabilitiesManifest {
  const generatedAt = "2026-03-13T12:00:00.000Z";
  return {
    manifestVersion: "1.0.0",
    generatedAt,
    app: { name: "Test App" },
    defaults: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
    capabilities: [
      {
        id: "api.orders.list-orders",
        kind: "read",
        displayTitle: "List orders",
        description: "List orders for testing.",
        inputSchema: { type: "object", properties: {} },
        policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
        sources: [{ type: "openapi" }],
        metadata: {},
      },
      {
        id: "api.orders.create-order",
        kind: "mutation",
        displayTitle: "Create order",
        description: "Create order mutation.",
        inputSchema: { type: "object", properties: {} },
        policy: { visibility: "internal", riskLevel: "high", confirmationPolicy: "required" },
        sources: [{ type: "openapi" }],
        metadata: {},
      },
    ],
  };
}

function createRuntime(
  manifest: AiCapabilitiesManifest,
  impl?: () => Promise<CapabilityExecutionResult>,
): CapabilityRuntimeInterface & { execute: ReturnType<typeof vi.fn> } {
  const executeImpl =
    impl ??
    (async () => ({
      capabilityId: "api.orders.list-orders",
      status: "success",
      data: { ok: true },
    }));
  const execute = vi.fn(executeImpl);
  return {
    execute,
    getManifest: () => manifest,
  };
}

interface InvokeOptions {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

async function invoke(
  handler: ExpressRequestHandler,
  options: InvokeOptions,
): Promise<{ statusCode?: number; payload?: JsonResponse; nextCalled: boolean }> {
  return new Promise((resolve, reject) => {
    const req = createRequest(options);
    let settled = false;
    const complete = (result: { statusCode?: number; payload?: JsonResponse; nextCalled: boolean }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const res = createResponse((value) => complete({ ...value, nextCalled: false }));

    try {
      handler(req, res, (err) => {
        if (err) {
          reject(err);
          return;
        }
        complete({ nextCalled: true });
      });
    } catch (error) {
      reject(error);
    }
  });
}

function createRequest(options: InvokeOptions): ExpressRequestLike {
  const stream = new PassThrough() as unknown as ExpressRequestLike;
  stream.method = options.method;
  stream.originalUrl = options.url;
  stream.url = options.url;
  stream.headers = { host: "demo.local" };
  stream.protocol = "http";
  if (options.body !== undefined) {
    stream.body = options.body;
  }
  process.nextTick(() => stream.end());
  return stream;
}

function createResponse(onJson: (value: { statusCode: number; payload: JsonResponse }) => void): ExpressResponseLike {
  let currentStatus = 200;
  const res: Partial<ExpressResponseLike> = {
    status(code: number) {
      currentStatus = code;
      (res as ExpressResponseLike).statusCode = code;
      return res as ExpressResponseLike;
    },
    json(body: JsonResponse) {
      onJson({ statusCode: currentStatus, payload: body });
      return res as ExpressResponseLike;
    },
    setHeader() {
      return undefined;
    },
    getHeader() {
      return undefined;
    },
    writeHead() {
      return res as ExpressResponseLike;
    },
    end() {
      return res as ExpressResponseLike;
    },
    statusCode: currentStatus,
  };

  return res as ExpressResponseLike;
}

function expectSuccess(payload?: JsonResponse) {
  if (!payload || payload.status !== "success") {
    throw new Error(`Expected success payload, received: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function expectError(payload?: JsonResponse) {
  if (!payload || payload.status !== "error") {
    throw new Error(`Expected error payload, received: ${JSON.stringify(payload)}`);
  }
  return payload;
}
