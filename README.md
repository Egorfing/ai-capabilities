# AI Capabilities
Expose real application actions (APIs, UI flows, background jobs) to AI agents safely through a structured capability layer.

Turn any application into an AI-executable system where agents can safely execute real actions—from backend APIs to navigation flows—through a single capability layer.

## Why AI Capabilities exists

Modern applications already ship countless executable actions—API endpoints, mutations, background jobs, UI flows—yet AI agents cannot reliably discover or safely trigger them. Tool-calling is fragile, UI actions and backend actions live in separate worlds, and there is no structured capability layer for AI agents.

AI Capabilities solves this by:

- Extracting hidden actions directly from your source code.
- Converting them into a canonical manifest with schemas, metadata, and policy.
- Providing a capability runtime, adapters, and discovery endpoints so agents can execute actions safely.
- Unifying backend APIs, UI/navigation flows, and policy controls in one place.

**What you get immediately**
- Automatic capability extraction from source code (OpenAPI, React Query, Router, Form).
- Canonical capability manifests with schemas, metadata, and policy.
- A capability runtime + policy layer that executes actions safely.
- AI tool adapters (OpenAI, Anthropic, internal agents).
- A discovery endpoint (`/.well-known/ai-capabilities.json`).

See [docs/architecture.md](docs/architecture.md) for the full flow.

Here is the “aha moment”: a single user request can trigger both backend and UI capabilities.

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
More scripted walkthroughs live in [docs/demo.md](docs/demo.md).

## How it works

```
Your application code
        ↓
ai-capabilities inspect
        ↓
ai-capabilities extract
        ↓
output/ capability manifest
        ↓
ai-capabilities scaffold
        ↓
src/ai-capabilities executable actions
        ↓
CapabilityRuntime
        ↓
AI agent / chat / server tools
```

- `output/` stores the generated manifest family (`ai-capabilities*.json`) and diagnostics.
- `src/ai-capabilities/` is where you keep the developer-authored actions that scaffolds create.
- `CapabilityRuntime` exposes only the capabilities you register, so agents/chats/server tools stay within the safe surface.
- Agents never call your application APIs directly—they call capabilities exposed by the runtime.

## Quickstart (10 minutes)

> Copy/paste commands. Every step works with humans _and_ coding assistants.

```bash
npm install ai-capabilities
npx ai-capabilities init
npx ai-capabilities inspect
npx ai-capabilities extract
npx ai-capabilities doctor
npx ai-capabilities serve
```

After these steps your application exposes a capability runtime and a discovery endpoint. You will have:

- `output/capabilities.raw.json` and `output/ai-capabilities.json`.
- `output/ai-capabilities.public.json` for external agents.
- `output/ai-capabilities.enriched.json` (after `enrich`).
- A running capability runtime on `localhost:4000` with `/\.well-known/ai-capabilities.json`.
- Confirmation that UI/Router adapters are wired (see [Frontend/UI capabilities](#runtime--frontend-actions)).
- Full walkthrough: [docs/quickstart.md](docs/quickstart.md).

### Zero-config quick scan

Run a full doctor → inspect → extract → detect-llm → `auto-bind --dry-run` pipeline (without touching your source code) via:

```bash
npx ai-capabilities
```

The command prints capability counts, safe auto-bind candidates, high-risk operations, and recommended next steps so you know exactly what to do next.

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

## Discovery standard
AI Capabilities formalizes a discovery contract for applications: serve a curated `/.well-known/ai-capabilities.json` (filtered to public visibility) so external agents can learn what your app can do. Think of it as `robots.txt + sitemap.xml + openapi.json` for AI-executable actions—agents fetch it to inspect capability IDs, schemas, and policies before calling your runtime. Keep destructive/internal actions out of this surface (leave them `internal`/`hidden`) so the well-known endpoint remains a safe bridge between your application and AI tools. See [docs/external-agents.md](docs/external-agents.md) and [docs/standardization.md](docs/standardization.md) for the full playbook.

### Consumer-side client SDK
External AI agents and integrations no longer need to hand-roll HTTP calls. The package now includes a tiny client entrypoint (`ai-capabilities/client`) with discovery + execution helpers:

```ts
import { discoverCapabilities, executeCapability } from "ai-capabilities/client";

const { manifest, getCapabilityById } = await discoverCapabilities("https://app.example.com");
const listOrders = getCapabilityById("api.orders.list-orders");

if (listOrders) {
  const result = await executeCapability("https://app.example.com", listOrders.id, { limit: 5 });
  console.log(result.status, result.data);
}
```

- `getWellKnownManifest(baseUrl)` — fetches `/.well-known/ai-capabilities.json`.
- `discoverCapabilities(baseUrl)` — wraps the manifest plus helper lookups for capability IDs.
- `executeCapability(baseUrl, capabilityId, input)` — POSTs to `/execute` and returns the runtime result (including policy denials).

Each helper accepts optional headers/signals plus a `fetch` override so you can reuse it from Node, browsers, or edge runtimes. See [docs/external-agents.md](docs/external-agents.md#client-sdk-quickstart) for details.

### Express / Node middleware
Need a production-ready Express path without writing custom routers? Mount the runtime with the new helper exported from `ai-capabilities/server`:

```ts
import express from "express";
import { CapabilityRuntime } from "ai-capabilities";
import { createAiCapabilitiesMiddleware } from "ai-capabilities/server";

const runtime = new CapabilityRuntime({ manifest, registry, mode: "public" });
const app = express();

app.use(
  createAiCapabilitiesMiddleware({
    runtime,
    manifest,
    mode: "public",
    basePath: "/ai-capabilities", // optional
  }),
);

app.listen(3000, () => console.log("Discovery ready on http://localhost:3000/ai-capabilities/.well-known/ai-capabilities.json"));
```

The middleware automatically wires:

- `GET /.well-known/ai-capabilities.json` (or `/ai-capabilities/.well-known/...` when `basePath` is set) backed by your public manifest.
- `GET /capabilities` for canonical manifest access (filtered when `mode: "public"`).
- `POST /execute` delegating to your `CapabilityRuntime`.

Check out [examples/express-app](examples/express-app) for a runnable sample that:

1. Registers a safe read capability (`api.orders.list-orders`) with fake order data.
2. Mounts the middleware in public mode.
3. Uses the client SDK to discover capabilities and execute the read operation.

Docs: [docs/server.md](docs/server.md#express--node-middleware).

## Authoring standard
Extracted manifests describe what exists in your code; authored capability files describe what agents are allowed to execute. The recommended authoring API is `defineCapability`/`defineCapabilityFromExtracted`—a stable DSL for executable actions that keeps schemas, policy, and handlers in one place.

```ts
import { defineCapabilityFromExtracted } from "ai-capabilities";

export const createProjectCapability = defineCapabilityFromExtracted({
  sourceId: "hook.create-project-mutation",
  id: "projects.create",
  displayTitle: "Create project",
  description: "Creates a new project",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" }
    },
    required: ["name"]
  },
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once"
  },
  aliases: ["create project", "new project"],
  exampleIntents: ["Create a project called Analytics"],
  async execute(input) {
    // Call your application/services here.
  },
});
```

- Use `defineCapabilityFromExtracted` when promoting a hook/endpoint discovered by `inspect`/`extract`—it preserves `sourceId` so you can trace the lineage.
- Use `defineCapability` when authoring UI/navigation actions or bespoke server operations from scratch.
- Keep all executable code under `src/ai-capabilities/**` (or `src/ai-capabilities/auto/**` when using `auto-bind`) and register everything via `registerCapabilityDefinitions`.

See [docs/define-capability.md](docs/define-capability.md) and [docs/standardization.md](docs/standardization.md) for the authoring philosophy.

## For AI coding assistants
If you're integrating AI Capabilities via Codex, Cursor, Claude Code, or similar tools:
- Run `npx ai-capabilities doctor`, `inspect --project .`, `extract --project .`, and `detect-llm --project .` before asking the developer additional questions.
- Prefer `npx ai-capabilities auto-bind --dry-run` for safe reads/creates, then scaffold higher-risk IDs with `npx ai-capabilities scaffold --id ...` for manual review.
- Implement handlers with `defineCapabilityFromExtracted` (or `defineCapability` for net-new actions) to stay on the authoring standard.
- Reuse any existing chat/LLM/runtime stack detected by `detect-llm`; do not introduce a second surface unless confirmed.
- Keep destructive capabilities internal/hidden until the developer explicitly approves exposing them.
- Follow [AGENTS.md](AGENTS.md) plus [docs/agent-installer-workflow.md](docs/agent-installer-workflow.md) for the canonical diagnose → summarize → ask → generate → integrate → summarize loop.
- Policy deep dive: [docs/policy.md](docs/policy.md).

## Onboarding CLI quick start
Run these commands in order before asking more questions:

```bash
npx ai-capabilities doctor
npx ai-capabilities inspect
npx ai-capabilities extract
npx ai-capabilities detect-llm
npx ai-capabilities scaffold --id <capability-id>
npx ai-capabilities auto-bind --dry-run
```

Discover extracted capability IDs at any time with:

```bash
npx ai-capabilities scaffold --list
```

Running `npx ai-capabilities scaffold` without `--id` now opens a numbered picker in interactive terminals so you can select an entry instead of copying the ID by hand. Non-interactive shells (CI, scripts) continue to print the list and exit so they stay deterministic.

Prefer `auto-bind` when you want to generate conservative `defineCapabilityFromExtracted` files for safe read/create operations in bulk. Use `--dry-run` to preview the plan, then review `src/ai-capabilities/auto/*.ts` before registering them.

Then register the generated capability in `src/ai-capabilities/registry.ts` and wire it into your runtime/chat surface.

Need to validate the full pilot experience? Follow [docs/pilot.md](docs/pilot.md) for extraction + enrichment drills.

Need more context? Follow [docs/happy-path.md](docs/happy-path.md) for the human workflow, [docs/llm-onboarding-workflow.md](docs/llm-onboarding-workflow.md) for coding assistants, [docs/llm-prompt.md](docs/llm-prompt.md) for capability-level prompts, and [docs/faq.md](docs/faq.md) for troubleshooting.

## Core concepts

### Capabilities & helper API

`defineCapability` keeps schema, metadata, policy, and handler in one file. Use it for net-new capabilities you author from scratch. When you start from an extracted item (e.g., `hook.create-project-mutation`) use `defineCapabilityFromExtracted` to keep the source linkage visible while providing a real handler. Both helpers emit the same runtime-ready shape, so you can mix them freely.

## Public API
Import everything from the package root:

```ts
import {
  defineCapability,
  defineCapabilityFromExtracted,
  registerCapabilityDefinitions,
  CapabilityRegistry,
  CapabilityRuntime,
  evaluatePolicy,
} from "ai-capabilities";
```

Avoid deep-importing from `src/*` or `dist/*`; the root entry exposes the supported surface.

## Risk levels at a glance

| Risk level | Meaning |
| --- | --- |
| safe | read-only lookups or diagnostics |
| low | harmless mutations (drafts, notifications) |
| medium | trusted create/update operations |
| high | destructive or sensitive actions (delete, transfer) |
| critical | production-risk actions requiring layered controls |

### Promoting an extracted capability
When `npx ai-capabilities inspect` surfaces `hook.create-project-mutation`, convert it into a runtime-ready definition without losing the source link:

```ts
import { defineCapabilityFromExtracted } from "ai-capabilities";
import { projectApi } from "../services/projectApi";

export const projectsCreateCapability = defineCapabilityFromExtracted({
  sourceId: "hook.create-project-mutation",
  id: "projects.create",
  displayTitle: "Create project",
  description: "Creates a workspace project and returns its identifier.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 3 },
      description: { type: "string" },
    },
    required: ["name"],
  },
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once",
  },
  async execute({ name, description }) {
    return projectApi.create({ name, description });
  },
});
```
`defineCapabilityFromExtracted` annotates the authored capability with `metadata.extractedSourceId`, so registries, manifests, and docs always keep a trace back to the original hook.

### Generating capability scaffolds from extracted actions
1. Run `npx ai-capabilities extract` (or `inspect`) and pick the extracted id you want to promote (e.g., `hook.create-project-mutation`).
2. Scaffold a file directly from the manifest:
   ```bash
   npx ai-capabilities scaffold --id hook.create-project-mutation
   ```
   Use `--manifest` to point at a custom canonical manifest and `--dir` to change the output directory if needed.
3. The CLI creates `src/ai-capabilities/capabilities/createProjectCapability.ts`:
   ```ts
   import { defineCapabilityFromExtracted } from "ai-capabilities";

   export const createProjectCapability = defineCapabilityFromExtracted({
     sourceId: "hook.create-project-mutation",
     // TODO: replace with your canonical id (e.g., "projects.create")
     id: "hook.create-project-mutation",
     displayTitle: "Create Project",
     description: "Create a project",
     inputSchema: {
       type: "object",
       properties: { name: { type: "string" } },
       required: ["name"]
     },
     policy: {
       visibility: "internal",
       riskLevel: "medium",
       confirmationPolicy: "none"
     },
     aliases: [],
     exampleIntents: [],
     tags: [],
     async execute(input) {
       throw new Error("TODO: implement execute handler for hook.create-project-mutation");
     }
   });
   ```
4. Fill in the execute handler, update the canonical `id`, and register the capability in `registry.ts`.

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

## Safety model

Capabilities represent real application actions that may modify data or trigger workflows, so every definition must declare policy metadata:

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

Start with the quickstart and happy-path guides before diving into the reference documentation:
- [docs/architecture.md](docs/architecture.md)
- [docs/standardization.md](docs/standardization.md)
- [docs/manifest.md](docs/manifest.md)
- [docs/extraction.md](docs/extraction.md)
- [docs/enrichment.md](docs/enrichment.md)
- [docs/adapters.md](docs/adapters.md)
- [docs/runtime.md](docs/runtime.md)
- [docs/define-capability.md](docs/define-capability.md)
- [docs/public-api.md](docs/public-api.md)
- [docs/agent-installer-workflow.md](docs/agent-installer-workflow.md)
- [docs/llm-onboarding-workflow.md](docs/llm-onboarding-workflow.md)
- [docs/agents-workflow.md](docs/agents-workflow.md)
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

**Choosing between prompts and guided onboarding**
- Use [docs/llm-onboarding-workflow.md](docs/llm-onboarding-workflow.md) when a coding assistant needs to integrate AI Capabilities end-to-end (inspect → detect existing AI stack → ask missing questions → generate files → wire chat/runtime).
- Use [docs/llm-prompt.md](docs/llm-prompt.md) when you only need targeted help filling in metadata or improving a single capability.

## Contributing

See [docs/contributing.md](docs/contributing.md) plus GitHub templates under `.github/`. Always run `npm test` before opening a PR and include `npx ai-capabilities doctor --json` output when reporting issues.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
