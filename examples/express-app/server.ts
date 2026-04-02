import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAiCapabilitiesMiddleware } from "ai-capabilities/server";
import { discoverCapabilities, executeCapability } from "ai-capabilities/client";
import { buildRuntimeAndManifest } from "./capabilities.js";

// ── LLM config ────────────────────────────────────────────────

const LLM_CONFIG = {
  baseUrl: process.env.LLM_BASE_URL ?? "",
  model: process.env.LLM_MODEL ?? "gpt-4o-mini",
  apiKey: process.env.LLM_API_KEY ?? "",
};

// ── Registry & Runtime ────────────────────────────────────────

const { manifest, runtime } = buildRuntimeAndManifest();

// ── LLM helpers ───────────────────────────────────────────────

function resolveEndpoint(baseUrl: string): { endpoint: string; isOllama: boolean } {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/chat(?:\/completions)?$/i.test(trimmed)) {
    const isOllama = trimmed.includes(":11434") || /\/api\/chat$/i.test(trimmed);
    return { endpoint: trimmed, isOllama };
  }
  if (/\/v\d+$/i.test(trimmed)) {
    return { endpoint: `${trimmed}/chat/completions`, isOllama: false };
  }
  return { endpoint: `${trimmed}/api/chat`, isOllama: true };
}

function buildSystemPrompt(): string {
  const capabilitiesList = manifest.capabilities.map((cap) => ({
    id: cap.id,
    kind: cap.kind,
    description: cap.description,
    aliases: cap.aliases,
    exampleIntents: cap.exampleIntents,
    inputSchema: cap.inputSchema,
  }));

  return `You are a capability planner for the app "${manifest.app.name}".

AVAILABLE CAPABILITIES:
${JSON.stringify(capabilitiesList, null, 2)}

INSTRUCTIONS:
1. Read the user's message carefully.
2. Match their intent to the MOST APPROPRIATE capability.
3. Fill in the "input" object according to the capability's inputSchema.
4. The user may write in any language — understand their intent regardless of language.

Always respond with ONLY this JSON structure, no extra text:
{
  "actions": [
    { "capabilityId": "<id from the list above>", "input": { ... } }
  ],
  "reply": "Brief response to the user describing what was done"
}`;
}

interface AgentPlan {
  actions: Array<{ capabilityId: string; input: Record<string, unknown> }>;
  reply: string;
}

async function callLLM(messages: Array<{ role: string; content: string }>): Promise<AgentPlan> {
  if (!LLM_CONFIG.baseUrl) {
    throw new Error("LLM_BASE_URL is not configured. Check your .env file.");
  }

  const { endpoint, isOllama } = resolveEndpoint(LLM_CONFIG.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LLM_CONFIG.apiKey) {
    headers.Authorization = `Bearer ${LLM_CONFIG.apiKey}`;
  }

  const body = isOllama
    ? { model: LLM_CONFIG.model, stream: false, format: "json", messages }
    : { model: LLM_CONFIG.model, temperature: 0, response_format: { type: "json_object" }, messages };

  console.log("[chat] requesting plan from LLM", endpoint);
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM returned ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  // Extract content from response
  let content: string;
  if (isOllama) {
    const msg = (data as any)?.message;
    content = typeof msg?.content === "string" ? msg.content : JSON.stringify(msg ?? data);
  } else {
    const c = (data as any)?.choices?.[0]?.message?.content;
    content = typeof c === "string" ? c : JSON.stringify(data);
  }
  console.log("[chat] LLM raw response:", content);

  // Parse JSON (handle markdown code blocks)
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match?.[1]) jsonStr = match[1];
  } else if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      reply: typeof parsed.reply === "string" ? parsed.reply : "",
    };
  } catch {
    console.warn("[chat] failed to parse LLM JSON:", jsonStr);
    return { actions: [], reply: content };
  }
}

// ── Express app ───────────────────────────────────────────────

async function main() {
  const app = express();

  // Serve static HTML UI
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.json());

  // AI Capabilities middleware (discovery + execute)
  app.use(
    createAiCapabilitiesMiddleware({
      runtime,
      manifest,
      publicManifest: manifest,
      mode: "public",
    }),
  );

  // Chat endpoint: natural language → LLM → capability execution
  // NOTE: Production deployments should add rate limiting, authentication,
  // and input validation before exposing this endpoint publicly.
  app.post("/chat", async (req, res) => {
    try {
      const { message, history } = req.body as {
        message: string;
        history?: Array<{ role: string; content: string }>;
      };

      if (!message) {
        res.status(400).json({ error: "message is required" });
        return;
      }

      const systemPrompt = buildSystemPrompt();
      const conversation = [
        { role: "system", content: systemPrompt },
        ...(history ?? []),
        { role: "user", content: message },
      ];

      const plan = await callLLM(conversation);

      // Execute each action
      const results: Array<{ capabilityId: string; status: string; data?: unknown; error?: string }> = [];
      for (const action of plan.actions) {
        try {
          const result = await runtime.execute({ capabilityId: action.capabilityId, input: action.input });
          results.push({
            capabilityId: action.capabilityId,
            status: result.status,
            data: result.status === "success" ? result.data : undefined,
            error: result.status !== "success" ? String(result.error ?? "unknown error") : undefined,
          });
        } catch (err) {
          results.push({
            capabilityId: action.capabilityId,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      res.json({ reply: plan.reply, actions: plan.actions, results });
    } catch (err) {
      console.error("[chat] error:", err);
      // Don't leak internal error details (LLM API keys, stack traces, internal paths)
      res.status(500).json({ error: "Internal server error. Check server logs for details." });
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, async () => {
    const baseUrl = `http://localhost:${port}`;
    console.log(`AI Capabilities middleware listening on ${baseUrl}`);
    console.log(`Chat UI available at ${baseUrl}`);
    console.log(`LLM: ${LLM_CONFIG.baseUrl || "(not configured)"} / ${LLM_CONFIG.model}`);
    if (process.env.RUN_CLIENT_DEMO !== "false") {
      await runClientDemo(baseUrl);
    }
  });
}

async function runClientDemo(baseUrl: string) {
  console.log("\n---- Discovery ----");
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

main().catch((error) => {
  console.error("Express example failed", error);
  process.exitCode = 1;
});
