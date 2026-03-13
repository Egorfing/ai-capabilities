import express from "express";
import {
  CapabilityRegistry,
  CapabilityRuntime,
  defineCapability,
  registerCapabilityDefinitions,
  type AiCapabilitiesManifest,
} from "ai-capabilities";
import { createAiCapabilitiesMiddleware } from "ai-capabilities/server";
import { discoverCapabilities, executeCapability } from "ai-capabilities/client";

const listOrdersCapability = defineCapability({
  id: "api.orders.list-orders",
  kind: "read",
  displayTitle: "List orders",
  description: "Fetch a filtered list of recent orders for the current workspace.",
  aliases: ["show orders", "orders.list"],
  exampleIntents: ["list my latest orders", "show pending orders"],
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "processing", "shipped", "delivered"],
        description: "Optional status filter",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 10,
        description: "Max number of orders to return",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
            total: { type: "number" },
            currency: { type: "string" },
          },
          required: ["id", "status", "total", "currency"],
        },
      },
      total: { type: "integer" },
    },
    required: ["items", "total"],
  },
  policy: {
    visibility: "public",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  execute: async (input) => {
    const orders = mockOrders();
    const filtered = input.status ? orders.filter((order) => order.status === input.status) : orders;
    const limit = typeof input.limit === "number" ? input.limit : 10;
    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
    };
  },
});

const registry = new CapabilityRegistry();
registerCapabilityDefinitions(registry, [listOrdersCapability]);

const manifest: AiCapabilitiesManifest = {
  manifestVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  app: {
    name: "Express AI Capabilities Demo",
    version: "0.1.0",
    baseUrl: "http://localhost:3000",
  },
  defaults: {
    visibility: "public",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  capabilities: [
    {
      id: listOrdersCapability.id,
      kind: listOrdersCapability.kind ?? "read",
      displayTitle: listOrdersCapability.displayTitle,
      description: listOrdersCapability.description,
      userDescription: listOrdersCapability.userDescription,
      aliases: listOrdersCapability.aliases,
      exampleIntents: listOrdersCapability.exampleIntents,
      inputSchema: listOrdersCapability.inputSchema,
      outputSchema: listOrdersCapability.outputSchema,
      policy: listOrdersCapability.policy,
      tags: ["demo"],
      sources: [{ type: "manual" }],
    },
  ],
};

const runtime = new CapabilityRuntime({ manifest, registry, mode: "public" });

async function main() {
  const app = express();
  app.use(
    createAiCapabilitiesMiddleware({
      runtime,
      manifest,
      mode: "public",
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, async () => {
    const baseUrl = `http://localhost:${port}`;
    console.log(`AI Capabilities middleware listening on ${baseUrl}`);
    if (process.env.RUN_CLIENT_DEMO !== "false") {
      await runClientDemo(baseUrl);
    }
  });
}

async function runClientDemo(baseUrl: string) {
  console.log("---- Discovery ----");
  const discovery = await discoverCapabilities(baseUrl);
  console.log("Capabilities:", discovery.capabilities.map((cap) => cap.id).join(", "));

  console.log("---- Execute ----");
  const result = await executeCapability(baseUrl, "api.orders.list-orders", { status: "pending", limit: 2 });
  if (result.status === "success") {
    console.log("List orders result:", result.data);
  } else {
    console.log("Execution finished with status:", result.status, result.error);
  }
}

function mockOrders() {
  return [
    { id: "ord_1001", status: "pending", total: 120.5, currency: "USD" },
    { id: "ord_1002", status: "processing", total: 89.0, currency: "USD" },
    { id: "ord_1003", status: "shipped", total: 45.99, currency: "USD" },
    { id: "ord_1004", status: "pending", total: 240.0, currency: "USD" },
  ];
}

main().catch((error) => {
  console.error("Express example failed", error);
  process.exitCode = 1;
});
