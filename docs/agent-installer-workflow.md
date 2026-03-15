# Agent installer workflow (extended)

This guide expands on [AGENTS.md](../AGENTS.md) for coding assistants such as Codex, Cursor, and Claude Code. Follow it when you are asked to “just wire up AI Capabilities” so you can diagnose automatically, minimize questions, and generate safe bindings quickly.

```
Detect signals → Run doctor/inspect/extract/detect-llm → Summarize → Ask missing questions → Auto-bind or scaffold → Register + integrate chat/runtime → Explain how to use it
```

## When to trigger this workflow
- Repository contains React Query hooks, OpenAPI/Swagger specs, API clients, or backend service modules.
- There is an existing chat UI or server-side agent entry point that should gain real actions.
- Navigation/UI flows (router, modal manager, form handlers) need to be exposed to an AI agent.
- `package.json` already references `openai`, `anthropic`, `ai`, `@vercel/ai`, `langchain`, `llm`, or similar dependencies.

## Phase 1 — Diagnose
Run the core commands in order (append `--json` when you need machine-readable output):
```bash
npx ai-capabilities doctor
npx ai-capabilities inspect --project .
npx ai-capabilities extract --project .
npx ai-capabilities detect-llm --project .
```
Record:
- Capability counts (total, read, mutation, navigation/UI).
- Risk distribution (safe/low/medium vs. high/critical).
- Empty schemas, diagnostics, or “unbound” capabilities reported by doctor.
- Existing authored capabilities under `src/app-capabilities/**/*`.
- Detected AI stacks (LLM client dependencies, chat components, server endpoints).

## Phase 2 — Summarize
Before asking any questions, send a snapshot that includes:
- Total/safe/dangerous capability counts.
- Safe reads vs. safe mutations vs. destructive items.
- IDs lacking schemas or bindings.
- Whether manifests (`output/ai-capabilities*.json`) are fresh.
- Whether `src/app-capabilities/capabilities`, `registry.ts`, `auto/`, or runtime helpers already exist.
- AI stack findings from `detect-llm` (e.g., “Vercel AI SDK detected in src/components/Chat.tsx”).

## Phase 3 — Ask only what you cannot infer
Keep the questionnaire short and specific:
1. Which safe capabilities should we expose first?
2. Which capabilities must remain internal or hidden?
3. Should the first agent live inside the existing chat UI or remain server-only?
4. Do we need UI/navigation actions (router/modals) exposed right now?
5. If no LLM provider is detected, which provider should we integrate (OpenAI, Anthropic, Azure, internal SDK)?

## Phase 4 — Generate bindings
1. **Auto-bind safe reads/creates**
   ```bash
   npx ai-capabilities auto-bind --manifest ./output/ai-capabilities.json --dir ./src/app-capabilities/auto
   ```
   - Use `--dry-run` to preview what will happen.
   - Review the generated files under `src/app-capabilities/auto/*.ts`.
2. **Scaffold the remaining capabilities**
   ```bash
   npx ai-capabilities scaffold --id hook.some-mutation --dir ./src/app-capabilities/capabilities
   ```
3. **Implement handlers**
   - Use `defineCapabilityFromExtracted` for extracted hooks (backend/service actions).
   - Use `defineCapability` for pure UI/navigation helpers.
   - Copy metadata, fill aliases/example intents, and set conservative policies (`visibility: "internal"`, `riskLevel: "low"` for reads, `riskLevel: "medium"` for safe mutations).
4. **Register everything**
   - Update `src/app-capabilities/registry.ts` (or equivalent) to include auto-bound and scaffolded exports.
   - Ensure runtime creators (usually `src/app-capabilities/index.ts` or `src/agent/runtime.ts`) call `registerCapabilityDefinitions`.

### Backend path checklist
- Implement handlers by calling API clients/services (e.g., `projectApi.list()`).
- Keep network bindings in one place (e.g., `services/projects.ts`) and call them from the capability.
- Provide examples/aliases referencing domain verbs (“List my projects”, “Show current workspace”).

### Frontend/UI path checklist
- For router actions, call `ctx.router.navigate("/projects/${projectId}")`.
- For modals/panels, call `ctx.ui.openPanel({ id: ... })` or similar adapters.
- Confirm that the runtime execution path injects `handlerContext.router/ui/notify`.

### Existing OpenAI / Vercel AI SDK path
- If `detect-llm` finds these dependencies, inspect the chat component or API route.
- Import the canonical manifest (`output/ai-capabilities.json`) and pass it to the model as tool definitions.
- Invoke `CapabilityRuntime` when the model selects a tool, forwarding `handlerContext`.
- Avoid spinning up a second chat UI—extend the detected one.

## Phase 5 — LLM/chat integration
- **In-app chat:** Extend the existing React/Vue/Svelte component to call the runtime. Reuse adapters and show an example transcript.
- **Server agent:** Wire `CapabilityRuntime` inside the API route or background worker. Document how to invoke it (HTTP request, queue message, etc.).
- **No stack detected:** Propose either the sample chat from `examples/react-app` or a minimal server endpoint, but confirm provider choice before adding dependencies.

## Phase 6 — Final summary
Your hand-off should always include:
- **Files:** Paths + short intent (e.g., ``src/app-capabilities/auto/projectsCapability.ts` — auto-bound read``).
- **Commands:** `npm run dev`, `npx ai-capabilities doctor`, `npx ai-capabilities auto-bind --dry-run`, etc.
- **Testing instructions:** How to trigger the new capabilities (chat prompt, runtime call, CLI).
- **Next steps:** e.g., “enrich metadata”, “publish `.well-known`”, “add confirmation policies for mutations”.

## Reference materials
- [AGENTS.md](../AGENTS.md) — quick checklist version of this workflow.
- [docs/llm-onboarding-workflow.md](./llm-onboarding-workflow.md) — narrative guide for assistants.
- [docs/happy-path.md](./happy-path.md) — developer-oriented onboarding walkthrough.
- [docs/faq.md](./faq.md) — troubleshooting for doctor/inspect/runtime issues.
