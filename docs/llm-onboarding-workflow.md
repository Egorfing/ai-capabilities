# Guided LLM onboarding workflow

This playbook targets coding assistants (Codex, Cursor, Claude Code, etc.) that are integrating AI Capabilities into an existing project. Pair it with [AGENTS.md](../AGENTS.md) for the quick checklist and [docs/agent-installer-workflow.md](./agent-installer-workflow.md) when you need deeper context. The goal is to inspect automatically, ask only what you cannot infer, and hand off reviewable changes.

```
Diagnose first → Detect existing AI stack → Ask only missing questions → Generate capabilities → Wire chat/runtime → Explain usage
```

## Quick-start commands for assistants
```bash
npx ai-capabilities doctor
npx ai-capabilities inspect
npx ai-capabilities extract
npx ai-capabilities detect-llm
```
Use `--json` on any command if you need structured output.

## Phase 1 — Diagnose automatically

Run the canonical commands first (append `--json` whenever you need structured output):
```bash
npx ai-capabilities doctor
npx ai-capabilities inspect --project .
npx ai-capabilities extract --project .
npx ai-capabilities detect-llm --project .
```
Collect the raw outputs—they will drive the summary in the next phase. If a manifest is missing, fix it (`npx ai-capabilities extract`) before proceeding.

## Phase 2 — Summarize the project

Before asking any questions, share a deterministic snapshot that covers:
- Total capabilities discovered (from `inspect`).
- Safe read counts, safe mutations, and dangerous/destructive capabilities (based on risk levels + destructive keywords).
- Capabilities with empty schemas or diagnostics.
- Capabilities marked “unbound” by `doctor`.
- Whether `output/ai-capabilities*.json` exists and is current.
- Whether `src/app-capabilities/**/*` already contains authored files (list key modules such as `capabilities/*.ts`, `registry.ts`, runtime helpers).
- Whether `detect-llm` found an AI stack and, if so, where it lives (package dependencies, `Chat.tsx`, API routes, runtime helpers).

When documenting the AI stack, automate the discovery:
- Scan `package.json` for `openai`, `anthropic`, `ai`, `@ai-sdk/*`, `@vercel/ai`, `langchain`, `llm`, or internal SDKs.
- Search for `Chat.tsx`, `agent/**`, `runtime.ts`, `llm.ts`, or API routes calling model endpoints.
- Note whether agents live inside the frontend or server.
- Capture existing `CapabilityRuntime` usage or adapters so you can extend them later.

Keep the phrasing grounded in actual IDs/kinds from the manifest output—avoid paraphrasing.

## Phase 3 — Ask only the missing questions

After inspection, ask concise yes/no or multiple-choice questions covering only the unknowns:

- “Which capabilities should the agent expose first? (Select from the safe read/mutation list.)”
- “Are there actions that must never be exposed?”
- “Should the first agent live in the existing chat UI, or run through the server/runtime only?”
- “Do you want frontend/UI actions (router/modals) available to the agent?”
- “Which LLM/provider should we wire to if none is referenced yet?”

If the repo already includes a provider, simply confirm reuse instead of asking the user to pick one again.

## Phase 4 — Generate capability files

1. **Auto-bind safe reads/creates**
   ```bash
   npx ai-capabilities auto-bind --manifest ./output/ai-capabilities.json --dir ./src/app-capabilities/auto --dry-run
   ```
   - Review the plan, then rerun without `--dry-run` to write conservative `defineCapabilityFromExtracted` files under `src/app-capabilities/auto/`.
   - The command intentionally skips destructive capabilities—take note of them for manual scaffolding.
2. **Scaffold the remaining IDs**
   ```bash
   npx ai-capabilities scaffold --id hook.create-project-mutation
   ```
3. **Implement the handlers**
   - Use `defineCapabilityFromExtracted` for backend/API work; keep the `sourceId` visible.
   - Use `defineCapability` for pure UI/navigation helpers that call `ctx.router`, `ctx.ui`, or `ctx.notify`.
   - Fill `id`, `displayTitle`, `description`, schemas, aliases, example intents, and conservative policies (`visibility: "internal"`, `riskLevel: "low"` for reads, `riskLevel: "medium"` + `confirmationPolicy: "once"` for create/update mutations).
   - Leave clear TODOs whenever execution wiring still needs human approval.
4. **Register everything**
   - Update `src/app-capabilities/registry.ts` (or the project’s registry) to include both auto-bound and scaffolded exports.
   - Ensure runtime helpers import the registry before constructing `CapabilityRuntime`.

**Backend example**

- Extracted id: `hook.create-project-mutation`.
- Actions:
  1. Scaffold → `src/app-capabilities/capabilities/createProjectCapability.ts`.
  2. Implement handler calling project API/service.
  3. Update `registry.ts` to include `createProjectCapability`.

**Frontend example**

- Extracted id: `navigation.open-project-page`.
- Actions:
  1. Author `openProjectPageCapability` with `defineCapability` (no scaffold needed).
  2. Use `ctx.router.navigate(\`/projects/${projectId}\`)`.
  3. Register alongside backend capabilities so the runtime can invoke it with adapters.

## Phase 5 — Wire the LLM/chat integration

Use the detection results:

- **Existing chat UI detected:** extend it by importing the manifest + runtime helpers; avoid creating a second chat surface.
- **Server-only agent:** show how to call `CapabilityRuntime` from existing API routes.
- **No AI stack yet:** offer a minimal chat component (reuse `examples/react-app` patterns) or explain how to start from `docs/happy-path.md`.

Confirm whether the developer wants an in-app experience or a server-only execution path before scaffolding UI code.

## Phase 6 — Explain how to use the result

Always finish with a concrete summary:

1. Files created/modified (paths + purpose).
2. Commands to run next (`npm run dev`, `npx ai-capabilities doctor`, `npx ai-capabilities auto-bind --dry-run`, etc.).
3. How to test the new capability (e.g., trigger via chat, call runtime directly, run CLI smoke test).
4. Suggested next steps (add more capabilities, expose `.well-known`, enrich metadata, etc.).

## LLM/AI detection checklist (reference)

- `package.json`: look for `openai`, `anthropic`, `@ai-sdk/openai`, `langchain`, `vercel-ai`, `@azure/openai`, custom SDK names.
- `src/**`: search for `Chat`, `Agent`, `Runtime`, `messages`, `toolCalls`, or `OpenAI.create`.
- `server/**` or `api/**`: inspect handlers calling LLM providers.
- `examples/` or `docs/` directories: see if the project already documents an AI integration you can extend.

When detection is inconclusive, state that explicitly and ask which provider/framework should be used.

## Example guided flows

### 1. Backend-first project with no chat yet
1. Run doctor/inspect/extract, note 4 safe reads, 2 mutations, no runtime bindings.
2. Detect no AI libraries.
3. Ask: “Which of these read/mutation capabilities should the agent expose first, and which LLM provider should we use?”
4. Scaffold + implement `hook.create-project-mutation` and `hook.projects-query`.
5. Provide instructions for adding a minimal chat UI (or server endpoint) using the chosen provider.

### 2. Frontend UI action onboarding
1. Extracted capability `navigation.open-project-page`.
2. Detect existing React Router component with `AppRouter`.
3. Ask only: “Do you want this navigation action available to the agent’s frontend runtime?”
4. Generate a `defineCapability` using `ctx.router.navigate`, register it, and explain how to pass `handlerContext.router`.

### 3. Existing Vercel AI SDK chat
1. Detect `@vercel/ai` in package.json and `src/components/Chat.tsx` referencing it.
2. Summarize safe capabilities and highlight existing chat stack.
3. Ask: “Should we extend the current Vercel AI chat with AI Capabilities, or keep a separate server-only agent?”
4. If the user says “extend”, wire the runtime into the existing chat component (import manifest, call `runtime.execute` when the agent selects a tool).
5. End with “Run `npm run dev`, open the chat, try: ‘Create a project called Pulse’, confirm runtime logs.”

---

Use this file as the north star for AI-assisted onboarding: diagnose the repo, reuse what exists, ask minimal questions, and produce small, reviewable pull requests.

Need more context? Pair this workflow with the CLI overview in [README.md](../README.md), the developer-focused [docs/happy-path.md](./happy-path.md), the prompt templates in [docs/llm-prompt.md](./llm-prompt.md), and the troubleshooting tips in [docs/faq.md](./faq.md).
