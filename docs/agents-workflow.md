# Coding assistant quick workflow

Use this checklist when acting as Codex/Cursor/Claude Code for AI Capabilities. The goal: diagnose first, ask only what you must, then generate reviewable changes.

## Commands to run immediately
```bash
npx ai-capabilities doctor
npx ai-capabilities inspect --project .
npx ai-capabilities extract --project .
npx ai-capabilities detect-llm --project .
```

## Summaries to produce
- Count of discovered capabilities (read vs mutation vs destructive).
- List any dangerous/destructive IDs and whether policy already protects them.
- Capabilities with empty schemas or missing bindings (`unbound` in doctor output).
- Whether `output/ai-capabilities*.json` exists and is up to date.
- Whether `src/ai-capabilities/**/*` exists (list key files such as `capabilities/*.ts`, `registry.ts`).

## Automatic detection
- In `package.json`, look for dependencies: `openai`, `ai`, `@ai-sdk/*`, `anthropic`, `langchain`, `vercel-ai`, custom `llm`/`agent` packages.
- Search the repo for existing chat UIs or agent runtimes (`Chat.tsx`, `agent/runtime.ts`, `server/ai.ts`, `CapabilityRuntime` usage).
- Record any API routes calling model endpoints or internal LLM services.

## Questions to ask (only if unknown)
1. Which capabilities should be exposed first?
2. Which ones must stay internal/never exposed?
3. Should the agent run inside the existing chat UI or via the server/runtime?
4. Do you need frontend/UI actions (router/modals)?
5. If no provider detected: which LLM provider should we integrate (OpenAI, Anthropic, internal, etc.)?

## What to generate
- Auto-bind obvious safe reads/creates:
  ```bash
  npx ai-capabilities auto-bind --manifest ./output/ai-capabilities.json --dir ./src/ai-capabilities/auto --dry-run
  ```
  Review the generated files in `src/ai-capabilities/auto/`, then register them.
- Scaffold selected extracted capabilities:
  ```bash
  npx ai-capabilities scaffold --id <extractedId>
  ```
  then implement `defineCapabilityFromExtracted` handlers, aliases, policy, and register them.
- Update `src/ai-capabilities/registry.ts` (or equivalent) with the new capabilities.
- Wire the runtime/chat integration into whichever surface already exists (reuse `Chat.tsx`, API routes, or add the minimal example only if nothing exists).
- Provide step-by-step usage instructions: commands to run, files touched, how to test the capabilities.

## Final deliverable checklist
- ✅ Diagnostics summary (doctor/inspect/extract).
- ✅ Detected AI stack and reuse plan.
- ✅ Answers to only the necessary questions.
- ✅ Generated capability files + registrations.
- ✅ LLM/chat wiring updates or guidance.
- ✅ Instructions on how to run/test and what to do next.
