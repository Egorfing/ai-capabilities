# AI Capabilities
Expose real application actions to AI agents safely.

Turn any application into an AI-compatible system where agents can safely execute real actions—from backend APIs to navigation flows—through a single capability layer.

## Why AI Capabilities exists

Modern applications are full of actions that humans perform every day (API handlers, background jobs, UI flows), but LLMs cannot discover or safely execute them. Tool-calling is fragile, UI actions and backend actions live in separate worlds, and there is no structured capability layer for AI agents.

AI Capabilities solves this by:

- Extracting hidden actions directly from your source code.
- Converting them into a canonical manifest with schemas, metadata, and policy.
- Providing a capability runtime, adapters, and discovery endpoints so agents can execute actions safely.
- Unifying backend APIs, UI/navigation flows, and policy controls in one place.

**What you get immediately**
- Capability extraction pipeline (OpenAPI, React Query, Router, Form).
- Canonical & public manifests.
- AI tool adapters (OpenAI, Anthropic, internal).
- Capability runtime + policy layer.
- Public discovery endpoint (`/.well-known/ai-capabilities.json`).

See [docs/architecture.md](docs/architecture.md) for the full flow.

## Demo: Create & open a project (aha moment)

```
User:  "Create a project called Analytics"
Agent plan:
  1. projects.create
  2. navigation.open-project-page (auto follow-up)
Result:
  - Project created via backend capability
  - UI navigates to the new project page with router/ui adapters
```

This deterministic agent lives in `examples/react-app`. Run it with `cd examples/react-app && npm install && npm run dev`, then type the prompt above to watch `[agent]` and `[runtime]` logs show the chained capabilities.

## Architecture overview

```
┌──────────┐   ┌─────────────┐   ┌─────────────┐   ┌────────────┐   ┌──────────────┐
│  Source  │→ │  Extraction  │→ │  Manifest    │→ │  Runtime &  │→ │  Agents / LLM │
│  code    │   │  & merge     │   │  builder    │   │  registry   │   │  tool calls   │
└──────────┘   └─────────────┘   └─────────────┘   └────────────┘   └──────────────┘
      ▲               │                │                  │                    │
      │               │                │                  │                    │
      │               ▼                ▼                  ▼                    │
      │        `capabilities.raw.json` │         `ai-capabilities.json`        │
      │                                ▼                                       │
      │                         Public manifest                                │
      │                                │                                       │
      └─────────────────────────────── UI/runtime bindings ↔ Frontend actions ─┘
```

1. **Extractors** read your code and produce diagnostic-rich raw capabilities.
2. **Manifest builder** normalizes/merges data into canonical & public JSON files.
3. **Runtime & registry** register handlers via `defineCapability` and enforce policy.
4. **Server & well-known** expose `/execute`, `/capabilities`, and `/.well-known/ai-capabilities.json`.
5. **Agents / LLMs** consume the manifest as tool definitions and call capabilities over HTTP or local bindings.

## Quickstart (10 minutes)

> Copy/paste commands. Every step works with humans _and_ coding assistants.

```bash
npm install                         # install dependencies
npx ai-capabilities init            # create ai-capabilities.config.json + scaffold
npx ai-capabilities inspect         # list extractable actions
npx ai-capabilities extract         # build raw + canonical + public manifests
npx ai-capabilities doctor          # readiness & safety report
npx ai-capabilities serve           # expose runtime + .well-known endpoint
```

After running the quickstart you will have:

- `output/capabilities.raw.json` and `output/ai-capabilities.json`.
- `output/ai-capabilities.public.json` for external agents.
- `output/ai-capabilities.enriched.json` (after `enrich`).
- A running capability runtime on `localhost:4000` with `/\.well-known/ai-capabilities.json`.
- Confirmation that UI/Router adapters are wired (see [Frontend/UI capabilities](#runtime--frontend-actions)).

### Example CLI output

```
$ npx ai-capabilities init
[init] Project: my-app
[init] created ai-capabilities.config.json
[init] created src/ai-capabilities/index.ts
[init] created src/ai-capabilities/registry.ts
[init] created src/ai-capabilities/capabilities/exampleCapability.ts

Next steps:
  1. Review ai-capabilities.config.json and adjust include/exclude paths for your repo.
  2. Replace src/ai-capabilities/capabilities/exampleCapability.ts with a real action.
  3. Run npx ai-capabilities inspect to see what the extractor picks up.
  4. Run npx ai-capabilities extract to build the manifest.
  5. Run npx ai-capabilities serve to expose the capability runtime.
```

## Example integration: React AI copilot

Clone or copy `examples/react-app` for a full happy-path reference:

```bash
cd examples/react-app
npm install
npm run dev
```

The example includes:

- Backend/read/ui capabilities built with `defineCapability`.
- Runtime wiring that injects router/ui/notify adapters (`examples/react-app/src/agent/runtime.ts`).
- A simple React chat UI + deterministic agent showing capability chaining.
- Ready-to-use scripts in [scripts/demo-run.md](scripts/demo-run.md) to reproduce the demo end-to-end.

Use it alongside [docs/happy-path.md](docs/happy-path.md) and [docs/file-structure.md](docs/file-structure.md) to copy the pattern into your app.

## Core concepts

### Capabilities & helper API

`defineCapability` keeps schema, metadata, policy, and handler in one file. Scaffolded structure:

```
src/
  ai-capabilities/
    index.ts          # runtime entry point
    registry.ts       # registers capabilities with CapabilityRegistry
    capabilities/
      createProject.ts
ai-capabilities.config.json
```

Running `npx ai-capabilities init` creates:

- `ai-capabilities.config.json` — project metadata, include/exclude rules, output paths.
- `src/ai-capabilities/index.ts` — re-export hub for registry/capability folders.
- `src/ai-capabilities/registry.ts` — registers capability definitions.
- `src/ai-capabilities/capabilities/exampleCapability.ts` — example action you can delete.

Example config:

```json
{
  "project": { "root": "." },
  "paths": {
    "include": ["src/**/*"],
    "exclude": [".claude/**", "node_modules/**", "dist/**", "output/**"]
  },
  "output": {
    "raw": "./output/capabilities.raw.json",
    "enriched": "./output/capabilities.enriched.json",
    "canonical": "./output/ai-capabilities.json",
    "public": "./output/ai-capabilities.public.json",
    "diagnostics": "./output/diagnostics.log",
    "tracesDir": "./output/traces"
  },
  "extractors": {
    "openapi": {},
    "reactQuery": {},
    "router": {},
    "form": {}
  },
  "manifest": { "app": { "name": "App" } }
}
```

Example scaffolded capability:

```ts
export const exampleCapability = {
  id: "example.echo",
  title: "Echo sample text",
  description: "Demonstrates how to register a local action for AI agents.",
  schema: {
    type: "object",
    properties: { text: { type: "string", description: "Any text" } },
    required: ["text"],
  },
  metadata: { tags: ["example"], visibility: "internal", riskLevel: "low" },
  async execute({ text }) {
    return { echoed: text, length: text.length };
  },
};
```

First real capability:

```ts
import { defineCapability } from "ai-capabilities";
import { api } from "../api";

export const createProjectCapability = defineCapability({
  id: "projects.create",
  displayTitle: "Create project",
  description: "Creates a new project visible to the current user.",
  inputSchema: {
    type: "object",
    properties: { name: { type: "string", description: "Project name" } },
    required: ["name"],
  },
  aliases: ["create project", "new project"],
  exampleIntents: ["Create a project called Analytics"],
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "none",
  },
  execute: async ({ name }) => api.createProject({ name }),
});
```

### Capability extraction & manifest

- **Why AI Capabilities** — tool-calling without structured metadata breaks; agents need schemas, policies, and execution guarantees.
- **What AI Capabilities does** — extracts actions, builds manifests, generates tool definitions, and runs capabilities with guardrails.
- **Comparison** — OpenAPI describes APIs; AI Capabilities describes executable actions (backend + UI).
- **Outputs** — raw manifest, canonical manifest, public manifest, enriched manifest, HTTP endpoints, and pilot reports.

### Runtime & frontend actions

Frontend actions use the same helper, but call router/ui adapters:

```ts
export const openProjectPage = defineCapability({
  id: "navigation.open-project-page",
  kind: "ui-action",
  displayTitle: "Open project page",
  description: "Navigates to the selected project inside the app",
  inputSchema: {
    type: "object",
    properties: { projectId: { type: "string", description: "Project identifier" } },
    required: ["projectId"],
  },
  policy: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
  async execute({ projectId }, ctx) {
    ctx?.router?.navigate(`/projects/${projectId}`);
    return { navigated: true };
  },
});
```

```ts
export const openCreateChartFlow = defineCapability({
  id: "modal.open-create-chart",
  kind: "ui-action",
  displayTitle: "Open chart creation flow",
  description: "Opens the chart creation modal or wizard.",
  inputSchema: {
    type: "object",
    properties: {
      datasetId: { type: "string" },
      mode: { type: "string", enum: ["quick", "advanced"], default: "quick" },
    },
    required: ["datasetId"],
  },
  tags: ["charts", "modal"],
  async execute({ datasetId, mode }, ctx) {
    await ctx?.ui?.openModal?.("chart-create", { datasetId, mode });
    ctx?.notify?.info?.("Chart creation flow opened");
    return { opened: true };
  },
});
```

Runtime execution with adapters:

```ts
await runtime.execute(
  { capabilityId: "navigation.open-project-page", input: { projectId: "proj_42" } },
  {
    handlerContext: {
      router: { navigate: (path) => appRouter.push(path) },
      ui: { openModal: (id, payload) => modals.open(id, payload) },
    },
  },
);
```

See [docs/frontend-actions.md](docs/frontend-actions.md) for deeper guidance.

### Capability chaining

Agents often chain multiple actions (create → navigate). The deterministic agent in `examples/react-app/src/agent/localAgent.ts` shows how to plan, execute, observe results, and trigger follow-up capabilities. Read [docs/capability-chaining.md](docs/capability-chaining.md) for patterns and safety tips.

### End-to-end example

1. **User**: “Create a project called Analytics.”
2. **Agent**: fetches `/.well-known/ai-capabilities.json`, discovers `projects.create`.
3. **Planner**: selects the OpenAI tool, fills `{ "name": "Analytics" }`.
4. **Runtime**: validates payload, checks policy, runs `createProject`.
5. **Application**: persists the project and returns a success payload.
6. **Agent**: relays confirmation back to the user (optionally chains navigation).

### Demo: fixtures/demo-app

В репозитории есть demo `fixtures/demo-app`, который показывает полный цикл:

1. **Извлечение** — `npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json` создаёт `output/capabilities.raw.json`.
2. **Manifest** — canonical/public версии лежат в `fixtures/golden/demo-app/ai-capabilities*.json`.
3. **Enrichment** — `npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock`.
4. **Runtime/Server** — `npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000` поднимает HTTP API; `GET /.well-known/ai-capabilities.json` показывает публичный surface.

## Safety model

Capabilities represent real actions, so every definition must declare policy metadata:

- **visibility** — `internal` (default), `public`, `hidden`.
- **riskLevel** — `safe`, `low`, `medium`, `high`, `critical`.
- **confirmationPolicy** — `none`, `once`, `always`.

Recommended defaults:

```ts
policy: {
  visibility: "internal",
  riskLevel: "low",
  confirmationPolicy: "none",
}
```

Use `npx ai-capabilities doctor` to verify readiness stages:

```
Status: Discoverable (unbound)
...
Integration maturity: DISCOVERABLE
Scale: NOT_INITIALIZED < INITIALIZED < EXTRACTED < DISCOVERABLE < PARTIALLY_EXECUTABLE < PILOT_READY
```

Refer to [docs/security-model.md](docs/security-model.md) for detailed risk guidance and [docs/external-agents.md](docs/external-agents.md) for publishing rules.

### Status and limitations (MVP)

- Node/TypeScript focus.
- Limited extractors (OpenAPI, React Query, Router, Form) out of the box.
- Mock enrichment by default.
- Simple runtime (single-tenant, manual bindings, no auth/rate limiting).

## CLI commands & workflows

### Using LLMs to complete capability definitions

Extraction gives you the surface; LLM prompts fill gaps. Use [docs/llm-prompt.md](docs/llm-prompt.md) or:

```bash
npx ai-capabilities prompt --template backend --file ./output/ai-capabilities.json --id hook.create-project-mutation
npx ai-capabilities prompt --template frontend --file ./output/ai-capabilities.json --id navigation.open-project-page
npx ai-capabilities prompt --template improve --file ./output/ai-capabilities.json --id modal.open-create-chart
npx ai-capabilities prompt --template allowlist --file ./output/ai-capabilities.json
```

### Diagnose your integration (`doctor`)

```
npx ai-capabilities doctor
npx ai-capabilities doctor --json
```

Doctor checks config presence, manifests, capability counts, scaffold files, and prints next steps.

### Repository quickstart scripts

```bash
npm install
npm run build
npm run test

npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json
npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock
npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000
npm run pilot -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json --with-enrich
```

## Documentation map

- [docs/architecture.md](docs/architecture.md)
- [docs/manifest.md](docs/manifest.md)
- [docs/extraction.md](docs/extraction.md)
- [docs/enrichment.md](docs/enrichment.md)
- [docs/adapters.md](docs/adapters.md)
- [docs/runtime.md](docs/runtime.md)
- [docs/define-capability.md](docs/define-capability.md)
- [docs/frontend-actions.md](docs/frontend-actions.md)
- [docs/llm-prompt.md](docs/llm-prompt.md)
- [docs/security-model.md](docs/security-model.md)
- [docs/capability-chaining.md](docs/capability-chaining.md)
- [docs/demo-scenario.md](docs/demo-scenario.md)
- [docs/doctor.md](docs/doctor.md)
- [docs/server.md](docs/server.md)
- [docs/external-agents.md](docs/external-agents.md)
- [docs/testing.md](docs/testing.md)
- [docs/contributing.md](docs/contributing.md)

## Карта документации

- [docs/quickstart.md](docs/quickstart.md) — расширенный пошаговый старт.
- [docs/demo.md](docs/demo.md) — walkthrough demo-проекта.
- [docs/architecture.md](docs/architecture.md) — обзор архитектуры и поток данных.
- [docs/manifest.md](docs/manifest.md) — контракт и артефакты manifest.
- [docs/extraction.md](docs/extraction.md) — поддерживаемые extractors и pipeline.
- [docs/enrichment.md](docs/enrichment.md) — enrichment слой и модельные клиенты.
- [docs/adapters.md](docs/adapters.md) — генерация tools для разных моделей.
- [docs/runtime.md](docs/runtime.md) — runtime, binding и execution flow.
- [docs/define-capability.md](docs/define-capability.md) — helper для ручных capability.
- [docs/frontend-actions.md](docs/frontend-actions.md) — явные UI/навигационные действия.
- [docs/llm-prompt.md](docs/llm-prompt.md) — LLM-подсказки.
- [docs/security-model.md](docs/security-model.md) — политика безопасности.
- [docs/capability-chaining.md](docs/capability-chaining.md) — цепочки capabilities.
- [docs/demo-scenario.md](docs/demo-scenario.md) — демо-сценарий.
- [docs/doctor.md](docs/doctor.md) — диагностика.
- [docs/policy.md](docs/policy.md) — safety/policy слой.
- [docs/server.md](docs/server.md) — HTTP API.
- [docs/external-agents.md](docs/external-agents.md) — public discovery.
- [docs/pilot.md](docs/pilot.md) — pilot run.
- [docs/testing.md](docs/testing.md) — стратегия тестирования.
- [docs/contributing.md](docs/contributing.md) — правила вклада.

## Package structure

Репозиторий готовит модульную экосистему:

- `@ai-capabilities/core` — manifest/types/config utilities
- `@ai-capabilities/extract` — extraction pipeline
- `@ai-capabilities/enrich` — enrichment utilities
- `@ai-capabilities/runtime` — runtime + policy binding
- `@ai-capabilities/adapters` — model tool adapters
- `@ai-capabilities/server` — HTTP transport + well-known
- `@ai-capabilities/cli` — CLI for extract/enrich/serve/pilot

## Основные сценарии

- **Внутренний AI copilot**: подключение к существующему проекту и предоставление LLM-помощнику списка доступных действий.
- **Model-agnostic tools**: генерация tool definitions для OpenAI, Anthropic или внутренних провайдеров из одного manifest.
- **Capability runtime**: безопасное исполнение capability через единый binding/policy слой.
- **Public agent discovery**: публикация публичных возможностей через `/.well-known/ai-capabilities.json`.
- **Pilot run**: воспроизводимый прогон на реальном приложении с отчётами и трассировкой.

## Contributing

See [docs/contributing.md](docs/contributing.md) plus GitHub templates under `.github/`. Always run `npm test` before opening a PR and include `npx ai-capabilities doctor --json` output when reporting issues.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
