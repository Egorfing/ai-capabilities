import type { AiCapabilitiesManifest, CapabilityExecutionResult } from "ai-capabilities";
import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExampleRuntime } from "../agent/runtime";

const LLM_CONFIG = {
  apiKey: import.meta.env.VITE_AI_CAP_LLM_API_KEY,
  baseUrl: import.meta.env.VITE_AI_CAP_LLM_BASE_URL ?? "",
  model: import.meta.env.VITE_AI_CAP_LLM_MODEL ?? "gpt-4o-mini",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentAction = {
  capabilityId: string;
  input?: Record<string, unknown>;
  autoConfirm?: boolean;
};

type AgentPlan = {
  actions: AgentAction[];
  reply?: string;
  raw?: string;
};

export function AiChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvents, setLastEvents] = useState<CapabilityExecutionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runtime = useMemo(
    () =>
      createExampleRuntime({
        router: { navigate: (path) => navigate(path) },
        ui: {},
        notify: {
          info: (msg) => console.log(`[notify] ${msg}`),
          warn: (msg) => console.warn(msg),
        },
      }),
    [navigate],
  );

  const llmReady = Boolean(LLM_CONFIG.baseUrl);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const input = (formData.get("chat-input") as string) ?? "";
    if (!input.trim()) {
      return;
    }

    setError(null);
    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    form.reset();
    setIsRunning(true);

    try {
      if (!llmReady) {
        throw new Error("LLM is not configured. Set VITE_AI_CAP_LLM_BASE_URL in .env.");
      }

      const conversation = [...messages, userMessage];
      const plan = await requestAgentPlan(conversation, runtime.manifest);
      if (!plan.actions.length) {
        throw new Error(
          plan.reply
            ? `LLM returned no actions. Model response: ${plan.reply}`
            : "LLM returned no actions. Try rephrasing your request.",
        );
      }

      const executionResults: CapabilityExecutionResult[] = [];
      for (const action of plan.actions) {
        const exec = await runtime.invoke(action.capabilityId, action.input ?? {});
        executionResults.push(exec);
        if (exec.status !== "success") {
          throw new Error(`Failed to execute ${action.capabilityId}: ${exec.error?.message ?? "error"}`);
        }
      }

      setLastEvents(executionResults);
      window.dispatchEvent(
        new CustomEvent("ai-capabilities:runtime-updated", {
          detail: { events: executionResults },
        }),
      );
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: plan.reply && plan.reply.trim().length > 0 ? plan.reply : summarizeEventsForReply(executionResults),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="ai-chat">
      <div className="badge ai-chat__status">{llmReady ? "LLM connected" : "LLM not configured"}</div>
      {!llmReady && (
        <div className="alert ai-chat__setup-alert">
          Set <code>VITE_AI_CAP_LLM_BASE_URL</code> (and optionally <code>VITE_AI_CAP_LLM_MODEL</code>) to enable the
          assistant.
        </div>
      )}
      <div className="ai-chat__messages">
        {messages.map((message, index) => (
          <div key={index} className={`ai-chat__bubble ai-chat__bubble--${message.role}`}>
            {message.content}
          </div>
        ))}
        {error ? <div className="alert">Agent error: {error}</div> : null}
        {lastEvents.length > 0 && (
          <div className="ai-chat__last-run">
            <strong>Last run:</strong>
            <ul>
              {lastEvents.map((event, idx) => (
                <li key={`${event.capabilityId}-${idx}-${event.status}`}>
                  {event.capabilityId} — {event.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="ai-chat__form">
        <input
          name="chat-input"
          placeholder={llmReady ? "Ask to create a project or add a todo" : "Configure LLM connection first"}
          disabled={isRunning || !llmReady}
        />
        <button type="submit" disabled={isRunning}>
          {isRunning ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

function summarizeEventsForReply(events: CapabilityExecutionResult[]): string {
  if (!events.length) {
    return "No capabilities were executed.";
  }
  const lines = events.map((event) => {
    const base = `${event.capabilityId}: ${event.status}`;
    if (event.status === "success" && event.data) {
      return `${base}. Result: ${JSON.stringify(event.data)}`;
    }
    if (event.status !== "success") {
      return `${base}. Error: ${event.error?.message ?? "unknown"}`;
    }
    return base;
  });
  return lines.join(" | ");
}

async function requestAgentPlan(conversation: ChatMessage[], manifest: AiCapabilitiesManifest): Promise<AgentPlan> {
  if (!LLM_CONFIG.baseUrl) {
    throw new Error("LLM endpoint is not configured.");
  }

  const capabilitiesList = manifest.capabilities.map((cap) => ({
    id: cap.id,
    kind: cap.kind,
    description: cap.description,
    aliases: cap.aliases,
    exampleIntents: cap.exampleIntents,
    inputSchema: cap.inputSchema,
  }));

  const systemPrompt = `You are a capability planner for the app "${manifest.app.name}".

AVAILABLE CAPABILITIES:
${JSON.stringify(capabilitiesList, null, 2)}

INSTRUCTIONS:
1. Read the user's message carefully.
2. Match their intent to the MOST APPROPRIATE capability by reading each capability's description, aliases, and exampleIntents.
3. Do NOT default to the first capability. Choose the one that semantically matches the user's request.
4. Fill in the "input" object according to the capability's inputSchema. Use the exact field names from the schema.
5. The user may write in any language (English, Russian, etc.) — understand their intent regardless of language.

IMPORTANT DISTINCTIONS:
- "projects.create" — ONLY for creating a NEW project (user says "create project", "new project")
- "projects.todos.add" — for adding a task/todo to an EXISTING project (user says "add todo", "add task", "добавь задачу")
- "projects.todos.toggle" — for marking a todo as done or reopening it
- "navigation.open-project-page" — for navigating to a project's page
- "projects.list" — for listing all projects

Always respond with ONLY this JSON structure, no extra text:
{
  "actions": [
    { "capabilityId": "<id from the list above>", "input": { ... } }
  ],
  "reply": "Brief response to the user describing what was done"
}`;

  const formattedMessages = [{ role: "system", content: systemPrompt }, ...conversation];
  const { endpoint, isOllama } = resolveEndpoint(LLM_CONFIG.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LLM_CONFIG.apiKey) {
    headers.Authorization = `Bearer ${LLM_CONFIG.apiKey}`;
  }

  const body = isOllama
    ? {
        model: LLM_CONFIG.model,
        stream: false,
        format: "json",
        messages: formattedMessages,
      }
    : {
        model: LLM_CONFIG.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: formattedMessages,
      };

  console.log("[assistant] requesting plan from LLM", endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`LLM returned error ${response.status}`);
  }
  const data = await response.json();
  const content = extractContentFromResponse(data, isOllama);
  console.log("[assistant] LLM raw response:", content);
  const plan = parseAgentPlan(content);
  console.log("[assistant] parsed plan:", JSON.stringify(plan.actions));
  return plan;
}

function extractContentFromResponse(data: any, isOllama: boolean): string {
  if (isOllama) {
    const message = data?.message;
    if (typeof message?.content === "string") {
      return message.content;
    }
    if (Array.isArray(message?.content)) {
      return message.content.map((chunk: any) => chunk?.text ?? chunk).join("\n");
    }
    return JSON.stringify(message ?? data);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  return JSON.stringify(data);
}

function parseAgentPlan(raw: string): AgentPlan {
  if (!raw) {
    return { actions: [], reply: "", raw };
  }
  const trimmed = raw.trim();
  const jsonCandidate = extractJson(trimmed);
  try {
    const parsed = JSON.parse(jsonCandidate);
    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      reply: typeof parsed.reply === "string" ? parsed.reply : "",
      raw: trimmed,
    };
  } catch (error) {
    console.warn("Failed to parse JSON plan", error, trimmed);
    return { actions: [], reply: trimmed, raw: trimmed };
  }
}

function extractJson(text: string): string {
  if (text.startsWith("```")) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function resolveEndpoint(baseUrl: string): { endpoint: string; isOllama: boolean } {
  const trimmed = baseUrl.replace(/\/+$/, "");

  // Explicit chat endpoint — use as-is
  if (/\/chat(?:\/completions)?$/i.test(trimmed)) {
    const isOllama = trimmed.includes(":11434") || /\/api\/chat$/i.test(trimmed);
    return { endpoint: trimmed, isOllama };
  }

  // Looks like an OpenAI-compatible base URL (contains /v1, /v2, etc.)
  if (/\/v\d+$/i.test(trimmed)) {
    return { endpoint: `${trimmed}/chat/completions`, isOllama: false };
  }

  // Bare host — assume Ollama
  return { endpoint: `${trimmed}/api/chat`, isOllama: true };
}
