import { describe, it, expect, vi } from "vitest";
import { discoverCapabilities, executeCapability, getWellKnownManifest } from "./index.js";
import { AiCapabilitiesClientError } from "./errors.js";
import type { FetchResponseLike } from "./types.js";

const baseUrl = "https://app.example.com";

const sampleManifest = {
  manifestVersion: "1.0.0",
  generatedAt: "2026-03-13T00:00:00.000Z",
  app: { name: "Fixture App" },
  discovery: {
    mode: "public",
    executionEndpoint: { method: "POST", path: "/execute" },
    capabilitiesEndpoint: { method: "GET", path: "/capabilities" },
  },
  policy: {
    defaultVisibility: "public",
    defaultRiskLevel: "low",
    defaultConfirmationPolicy: "none",
    confirmationSupported: false,
  },
  interaction: {
    toolCalling: true,
    httpExecution: true,
    streaming: false,
  },
  capabilities: [
    {
      id: "api.orders.list-orders",
      kind: "read",
      displayTitle: "List orders",
      description: "Lists customer orders",
      inputSchema: { type: "object", properties: { limit: { type: "number" } } },
      policy: {
        visibility: "public",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
    },
  ],
};

describe("client SDK", () => {
  it("fetches the well-known manifest", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(200, success(sampleManifest)));
    const manifest = await getWellKnownManifest(baseUrl, { fetch: fetchMock });
    expect(manifest.app.name).toBe("Fixture App");
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/.well-known/ai-capabilities.json`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws a helpful error when well-known returns 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(404, error("NOT_FOUND", "Missing")));
    await expect(getWellKnownManifest(baseUrl, { fetch: fetchMock })).rejects.toBeInstanceOf(AiCapabilitiesClientError);
  });

  it("discoverCapabilities returns lookup helper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(200, success(sampleManifest)));
    const result = await discoverCapabilities(baseUrl, { fetch: fetchMock });
    expect(result.capabilities).toHaveLength(1);
    expect(result.getCapabilityById("api.orders.list-orders")?.displayTitle).toBe("List orders");
  });

  it("executeCapability returns runtime result on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(
        200,
        {
          status: "success",
          data: { items: [] },
          meta: { capabilityId: "api.orders.list-orders", durationMs: 5, status: "success" },
        },
      ),
    );
    const result = await executeCapability(
      baseUrl,
      "api.orders.list-orders",
      { limit: 5 },
      { fetch: fetchMock, requestId: "req_123" },
    );
    expect(result.status).toBe("success");
    expect(result.data).toEqual({ items: [] });
    expect(result.durationMs).toBe(5);
    expect(result.capabilityId).toBe("api.orders.list-orders");
  });

  it("executeCapability captures server errors without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(
        403,
        {
          status: "error",
          error: { code: "POLICY_DENIED", message: "Denied" },
          meta: { capabilityId: "api.orders.list-orders", status: "denied" },
        },
      ),
    );
    const result = await executeCapability(baseUrl, "api.orders.list-orders", {}, { fetch: fetchMock });
    expect(result.status).toBe("denied");
    expect(result.error?.code).toBe("POLICY_DENIED");
    expect(result.error?.message).toBe("Denied");
  });

  it("respects fetch overrides", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(200, success(sampleManifest)));
    await getWellKnownManifest(baseUrl, { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function createResponse(status: number, body: unknown): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    headers: {
      get() {
        return null;
      },
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function success<T>(data: T) {
  return { status: "success", data };
}

function error(code: string, message: string) {
  return { status: "error", error: { code, message } };
}
