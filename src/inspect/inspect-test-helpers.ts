import type { AiCapabilitiesManifest, AiCapability, DiagnosticEntry } from "../types/index.js";
import type { InspectLoadResult } from "./inspect-types.js";
import { projectRoot } from "../test-helpers/fixtures.js";
import { createTestConfig } from "../test-helpers/config.js";

export function createInspectLoadFixture(): InspectLoadResult {
  const projectPath = projectRoot("fixtures", "demo-app");
  const manifest = createManifest();
  const diagnostics: DiagnosticEntry[] = [
    {
      level: "warning",
      stage: "extraction",
      message: "Custom wrapper not supported",
    },
  ];
  const publicOnly: AiCapabilitiesManifest = {
    ...manifest,
    capabilities: manifest.capabilities.filter((cap) => cap.policy.visibility === "public"),
  };
  return {
    projectPath,
    config: createTestConfig(projectPath),
    manifest,
    publicManifest: publicOnly,
    diagnostics,
    extractorsRun: ["react-query", "router"],
  };
}

function createManifest(): AiCapabilitiesManifest {
  const capabilities: AiCapability[] = [
    {
      id: "orders.create",
      kind: "mutation",
      displayTitle: "Create order",
      description: "Create a new order",
      inputSchema: { type: "object" },
      policy: {
        visibility: "internal",
        riskLevel: "medium",
        confirmationPolicy: "once",
      },
      execution: {
        mode: "http",
        endpoint: { method: "POST", path: "/orders" },
      },
      sources: [{ type: "openapi", filePath: "orders.yml" }],
    },
    {
      id: "orders.status.get",
      kind: "read",
      displayTitle: "Get order status",
      description: "Fetch order status",
      inputSchema: { type: "object" },
      policy: {
        visibility: "public",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      execution: {
        mode: "frontend-bridge",
        handlerRef: "orders.status",
      },
      sources: [{ type: "router", filePath: "routes.tsx" }],
    },
    {
      id: "reports.export",
      kind: "workflow",
      displayTitle: "Export reports",
      description: "Export analytics",
      inputSchema: { type: "object" },
      policy: {
        visibility: "public",
        riskLevel: "high",
        confirmationPolicy: "always",
      },
      sources: [{ type: "custom", filePath: "reports.ts" }],
    },
  ];

  return {
    manifestVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    app: { name: "Test App" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities,
  };
}
