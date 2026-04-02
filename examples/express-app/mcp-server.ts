#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) server for ai-capabilities.
 *
 * Exposes the same capabilities as the Express server, but over
 * the MCP stdio transport so that Claude Desktop, Cursor, and
 * other MCP hosts can discover and call them.
 *
 * Usage:
 *   npx tsx mcp-server.ts                          # run directly
 *   npx @modelcontextprotocol/inspector npx tsx mcp-server.ts  # interactive test UI
 *
 * Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "ai-capabilities-demo": {
 *         "command": "npx",
 *         "args": ["tsx", "/absolute/path/to/examples/express-app/mcp-server.ts"]
 *       }
 *     }
 *   }
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { buildMcpTools, type McpTool } from "ai-capabilities";
import { buildRuntimeAndManifest } from "./capabilities.js";

// ── Build runtime & MCP tools ─────────────────────────────────

const { runtime, manifest } = buildRuntimeAndManifest();
const tools = buildMcpTools(manifest);

// name → McpTool lookup for fast dispatch
const toolMap = new Map<string, McpTool>(tools.map((t) => [t.name, t]));

// ── MCP Server ────────────────────────────────────────────────

const server = new Server(
  { name: "ai-capabilities-demo", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  })),
}));

// Execute a tool call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap.get(name);

  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await runtime.execute({
      capabilityId: tool.capabilityId,
      input: args ?? {},
    });

    if (result.status === "success") {
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }

    return {
      content: [{ type: "text", text: `Execution failed: ${result.error ?? "unknown error"}` }],
      isError: true,
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use stderr — stdout is reserved for MCP JSON-RPC messages
  console.error("ai-capabilities MCP server running on stdio");
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
