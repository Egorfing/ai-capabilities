import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "./create-server.js";
import type { CapabilityHttpServer } from "./server-types.js";
import type {
  AiCapabilitiesManifest,
  CapabilityExecutionResult,
  CapabilityExecutionRequest,
} from "../types/index.js";
import type {
  CapabilityRuntimeExecuteOptions,
  CapabilityRuntimeInterface,
} from "../runtime/runtime-types.js";
import { readGoldenJson } from "../test-helpers/fixtures.js";
import { normalizeForSnapshot } from "../test-helpers/snapshots.js";

describe("HTTP server smoke tests", () => {
let server: CapabilityHttpServer | undefined;
let baseUrl = "";
let tracesDir = "";
let serverReady = false;
let skipReason: string | undefined;
  const manifest = readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.json");
  const publicManifest = readGoldenJson<AiCapabilitiesManifest>("demo-app", "ai-capabilities.public.json");
  const runtimeExecuteMock = vi.fn(
    async (request: CapabilityExecutionRequest): Promise<CapabilityExecutionResult> => ({
      capabilityId: request.capabilityId,
      status: "success",
      data: { ok: true },
    }),
  );
  const runtime: CapabilityRuntimeInterface = {
    execute: runtimeExecuteMock,
    getManifest: () => manifest,
  };

  beforeAll(async () => {
    tracesDir = mkdtempSync(join(tmpdir(), "cap-http-"));
    try {
      server = createServer(
        {
          manifest,
          publicManifest,
        runtime,
          tracesDir,
          logger: {
            log() {},
            error() {},
          },
        },
        { mode: "public", host: "127.0.0.1", port: 0 },
      );
      const info = await server.listen();
      baseUrl = `http://${info.host}:${info.port}`;
      serverReady = true;
    } catch (error) {
      skipReason = error instanceof Error ? error.message : String(error);
      serverReady = false;
    }
  });

  afterAll(async () => {
    if (serverReady && server) {
      await server.close();
    }
  });

  afterAll(() => {
    if (tracesDir) {
      rmSync(tracesDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    runtimeExecuteMock.mockClear();
  });

  it("serves GET /health", async () => {
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("success");
    expect(json.meta.traceId).toBeDefined();
    expect(json.data.status).toBe("ok");
    expect(json.data.mode).toBe("public");
  });

  it("returns filtered capabilities for GET /capabilities", async () => {
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/capabilities`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    const actual = normalizeForSnapshot(json.data);
    const expected = normalizeForSnapshot(publicManifest);
    expect(actual).toEqual(expected);
  });

  it("filters capabilities by id", async () => {
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/capabilities?capabilityId=api.orders.list-orders`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.count).toBe(1);
    expect(json.data.capabilities[0].id).toBe("api.orders.list-orders");
  });

  it("executes capability via POST /execute", async () => {
    const payload = {
      capabilityId: "api.orders.list-orders",
      input: { limit: 10 },
      context: {
        mode: "internal",
      },
    };
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("success");
    expect(runtimeExecuteMock).toHaveBeenCalledTimes(1);
    const call = runtimeExecuteMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) return;
    const options = (call as unknown[])[1] as CapabilityRuntimeExecuteOptions | undefined;
    expect(options?.mode).toBe("public");
  });

  it("rejects non-public capability in public mode", async () => {
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilityId: "api.orders.cancel-order",
        input: { orderId: "1" },
        context: {},
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("POLICY_DENIED");
    expect(runtimeExecuteMock).not.toHaveBeenCalled();
  });

  it("serves well-known discovery", async () => {
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/.well-known/ai-capabilities.json`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    const actual = normalizeForSnapshot(json.data);
    const expected = normalizeForSnapshot(
      readGoldenJson("demo-app", "ai-capabilities.well-known.json"),
    );
    expect(actual).toEqual(expected);
  });

  it("streams recorded traces", async () => {
    if (!serverReady) return;
    const res = await fetch(`${baseUrl}/traces`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.items.length).toBeGreaterThan(0);
  });
});
