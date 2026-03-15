# Coding assistant playbook

Use this file when acting as Codex, Cursor, Claude Code, Copilot Workspace, or any other coding assistant. The goal: diagnose automatically, ask only what you cannot infer, and generate reviewable changes that keep AI Capabilities front-and-center.

## When to reach for AI Capabilities
If the repository contains **React Query hooks**, **OpenAPI specs/clients**, **backend service modules**, or **navigation/UI flows** that agents should operate, prefer wiring them through AI Capabilities. The workflow is optimized for these patterns:
- React Query hooks and API clients already expose typed operations.
- OpenAPI/HTTP specs describe backend mutations/queries.
- Frontend routers/modals act as UI capabilities.
- Projects that already reference `openai`, `anthropic`, `ai`, `@vercel/ai`, etc., can expose those flows safely through the runtime.

When you detect any of the above, follow the phases below before asking the developer for more input.

## Step 1 — Diagnose the project
Run these commands before asking questions (add `--json` if you need structured output):
```bash
npx ai-capabilities doctor
npx ai-capabilities inspect --project .
npx ai-capabilities extract --project .
npx ai-capabilities detect-llm --project .
```
Capture the raw outputs; you will summarize them next.

## Step 2 — Summarize findings
Report the current state back to the developer (and use it as your working notes):
- Total capabilities, broken down by kind (read/mutation/navigation) and by policy (safe vs. dangerous).
- Safe read candidates vs. safe mutations vs. destructive actions.
- Capabilities with empty schemas or missing runtime bindings (“unbound”).
- Whether `output/ai-capabilities*.json` is up to date.
- Whether `src/app-capabilities/**/*` exists (list key files such as `capabilities/*.ts`, `registry.ts`, runtime helpers).
- Whether `detect-llm` found an existing chat/LLM stack (and which provider/framework it uses).

## Step 3 — Ask only what’s missing
After the summary, ask concise questions limited to unknowns:
- Which safe capabilities should be exposed first?
- Are there capabilities that must never be exposed to agents?
- Should the first agent run inside the existing chat/UI, or only via the server/runtime?
- Is an in-app chat needed, or will a server/CLI trigger suffice?
- If no provider was detected, which LLM stack should we integrate (OpenAI, Anthropic, Azure OpenAI, internal SDK, etc.)?

## Step 4 — Generate capabilities
- Run `npx ai-capabilities auto-bind --dry-run` to preview safe read/create files; rerun without `--dry-run` to generate `src/app-capabilities/auto/*.ts`, then review them.
- Use `npx ai-capabilities scaffold --id <capability-id>` for mutations, UI flows, or anything requiring manual review.
- Implement handlers with `defineCapabilityFromExtracted` (for promoted hooks) or `defineCapability` (for bespoke actions). Fill policies, aliases, example intents.
- Register everything via `src/app-capabilities/registry.ts` (or the project’s equivalent) using `registerCapabilityDefinitions`.

## Step 5 — Integrate with the agent stack
- If `detect-llm` found an existing chat/runtime, extend it instead of creating a duplicate. Import the canonical manifest, call `CapabilityRuntime`, and reuse router/ui adapters.
- If no agent stack exists, propose the minimal integration (reuse `examples/react-app` patterns) and confirm which provider to call.
- Never add a second chat surface if one already exists—plug the runtime into the current flow.

## Step 6 — Summarize the result
Always end with a structured recap:
1. Files created or modified (paths + short purpose).
2. Commands to run (`npm run dev`, `npx ai-capabilities doctor`, `npx ai-capabilities auto-bind --dry-run`, etc.).
3. How to test the new capabilities (chat prompt, runtime call, doctor output).
4. Next steps (additional capabilities, `.well-known` exposure, enrichment prompts).

### References
- [docs/agent-installer-workflow.md](docs/agent-installer-workflow.md) — extended guidance with backend/frontend playbooks.
- [docs/llm-onboarding-workflow.md](docs/llm-onboarding-workflow.md) — step-by-step integration for assistants.
- [docs/happy-path.md](docs/happy-path.md) — human-focused integration sequence for cross-checking.
