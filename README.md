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
- Automatic capability extraction from source code (OpenAPI / Swagger specs, React Query hooks, Router, Form).
- Canonical capability manifests with schemas, metadata, and policy.
- A capability runtime + policy layer that executes actions safely.
- AI tool adapters (OpenAI, Anthropic, MCP, internal agents).
- A discovery endpoint (`/.well-known/ai-capabilities.json`).

See [docs/architecture.md](docs/architecture.md) for the full flow.

Here is the “aha moment”: a single user request can trigger both backend and UI capabilities.

## Demo: Create & open a project (aha moment)

![Demo: assistant creating a project, adding a todo, and navigating to the project page](docs/demo.gif)

The assistant creates a project, adds a todo, and navigates to the project detail page — all through natural language mapped to capability executions.

This live agent runs in `examples/react-app`. Try it:

```bash
cd examples/react-app && npm install && npm run dev:full
```

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
src/app-capabilities executable actions
        ↓
CapabilityRuntime
        ↓
AI agent / chat / server tools
```

- `output/` stores the generated manifest family (`ai-capabilities*.json`) and diagnostics.
- `src/app-capabilities/` is where you keep the developer-authored actions that scaffolds create.
- `CapabilityRuntime` exposes only the capabilities you register, so agents/chats/server tools stay within the safe surface.
- Agents never call your application APIs directly—they call capabilities exposed by the runtime.

> Legacy note: versions prior to 0.3 scaffolded `src/ai-capabilities`. The CLI still recognizes that directory for backward compatibility, but it now warns and recommends renaming to `src/app-capabilities` to avoid collisions with the `ai-capabilities` npm package name.

## Quickstart: first working capability (guided)

> CLI commands run fast, but a capability is only “done” after manual authoring and testing. Follow the phases below or dive into [docs/quickstart.md](docs/quickstart.md) for the long-form guide.

1. **Bootstrap:** `npm install ai-capabilities && npx ai-capabilities init` creates the config file and scaffold directory.
2. **Discover:** `npx ai-capabilities inspect/extract/doctor` captures the discovered capabilities and writes the manifest (`output/ai-capabilities*.json`).
3. **Select & Scaffold:** pick a specific id and run `npx ai-capabilities scaffold --id <capability-id>`.
4. **Author:** open the generated file under `src/app-capabilities/capabilities/**`, implement `execute`, and confirm `inputSchema`/`outputSchema`, policy, and metadata.
5. **Register & Wire:** import the capability inside `src/app-capabilities/registry.ts`, pass it to `registerCapabilityDefinitions`, and make sure your runtime is instantiated (locally or via `npx ai-capabilities serve`).
6. **Smoke-test:** call `POST /execute` or invoke the runtime directly to prove the capability actually runs. Only after a successful test should you consider it ready.

The outcome is more than a manifest—you end up with at least one verified executable capability that agents can call. Everything else (public manifest, enrich, HTTP runtime) stays the same but is clearly separated from the manual steps.

### Zero-config quick scan

Run a full doctor → inspect → extract → detect-llm → `auto-bind --dry-run` pipeline (without touching your source code) via:

```bash
npx ai-capabilities
```

The command prints capability counts, safe auto-bind candidates, high-risk operations, and recommended next steps so you know exactly what to do next.

**Need to decide between an app-local runtime, HTTP runtime, or mixed visibility?** See [docs/mixed-scenarios.md](docs/mixed-scenarios.md) for a decision matrix that covers internal agents, public discovery, browser/Node consumers, env patterns, and fallback strategies.

### Already have an OpenAPI / Swagger spec?

If your project ships an OpenAPI 3.x or Swagger 2.0 spec, capabilities are extracted automatically — each endpoint becomes a callable capability with schemas, risk level, and metadata.

**3 steps to go from spec to capabilities:**

```bash
# 1. Point the config at your spec (or skip — standard filenames are auto-discovered)
cat > ai-capabilities.config.json <<'EOF'
{
  "extractors": {
    "openapi": { "spec": "path/to/openapi.json" }
  }
}
EOF

# 2. Extract — every endpoint becomes a capability in the manifest
npx ai-capabilities extract

# 3. See which endpoints are safe to auto-scaffold
npx ai-capabilities auto-bind --dry-run
```

Each endpoint yields a capability with:
- **ID** from `operationId` (or tag + path fallback)
- **inputSchema** merged from query/path params and request body
- **outputSchema** from the first 2xx response
- **Kind**: `read` for GET, `mutation` for POST/PUT/PATCH/DELETE
- **Risk classification**: safe reads auto-bind; destructive operations (delete, wipe) are flagged

> **Auto-discovery:** if your spec lives in the project root under a standard name (`openapi.json`, `openapi.yaml`, `swagger.json`, `swagger.yaml`), no config is needed — the extractor finds it automatically.

Full extractor details → [docs/extraction.md](docs/extraction.md)

### Public manifest snapshot

The HTTP runtime and discovery endpoint now require an explicit public manifest file (`output/ai-capabilities.public.json`). Generate it whenever you update the canonical manifest:

```bash
npx ai-capabilities manifest public \
  --input ./output/ai-capabilities.json \
  --output ./output/ai-capabilities.public.json
```

`/.well-known/ai-capabilities.json` stays disabled unless this file exists (or you run the dev-only `--unsafe-public-fallback` flag). This makes accidental exposure of internal capabilities far less likely.

### Loading manifests programmatically

Need to hydrate an agent or worker without re-implementing HTTP/local fallbacks? Use the new manifest loader utility:

```ts
import { loadManifest } from "ai-capabilities";

const result = await loadManifest({
  runtimeUrl: process.env.AI_CAP_RUNTIME_URL,
  localPath: "./output/ai-capabilities.public.json",
  expectedVisibility: "public",
  allowFallback: true,
  cacheTtlMs: 60_000,
});

console.log(`Loaded ${result.manifest.capabilities.length} capabilities from ${result.sourceKind}`);
```

`loadManifest` automatically picks the right source (remote HTTP vs. local file), enforces public/internal boundaries, and reports whether fallback or cache were used. See [docs/mixed-scenarios.md](docs/mixed-scenarios.md#manifest-loader-helper) for details.

### Capability lifecycle status

Use the status command to understand where each capability sits on the path from “discovered” to “executable”:

```bash
npx ai-capabilities status
```

Output example:

```
Capability lifecycle summary
----------------------------
Discovered : 17
Scaffolded : 12
Authored   : 4
Registered : 3
Runtime    : detected
Executable : 2

Capability status (yes / no / unknown)
ID                            Disc  Scaf  Auth  Reg   Wired Exec  Notes
api.orders.list-orders        yes   yes   yes   yes   yes  yes    -
api.orders.create-order       yes   yes   no    no    yes  no     Handler TODO placeholder detected; Not found in registry.ts
api.orders.cancel-order       yes   no    unknown no   yes  no     Build scaffold and register capability
```

- `yes`/`no` statuses are only reported when the tool can prove the state. Otherwise you see `unknown`.
- `wired` and `executable` rely on heuristics (runtime instantiation detection + registry authoring); treat them as guidance rather than proof.
- `notes` list the next obvious step (scaffold missing, registry entry missing, etc.).

### Forgot to run `init`?

When you run `npx ai-capabilities` (or any command that needs the config) before bootstrapping the project, the CLI now performs a preflight check instead of crashing:

```
This project does not appear to be initialized for ai-capabilities yet.
Required setup files were not found:
  • ai-capabilities.config.ts|json keeps project paths/output directories for every command.
  • src/app-capabilities/registry.ts — Capability registry scaffold (created by ai-capabilities init).

Run `ai-capabilities init` now? [Y/n]
```

- **Interactive shells**: you'll be prompted once to run `ai-capabilities init` automatically; accept to scaffold the config + `src/app-capabilities` without retyping the command.
- **CI / non-interactive shells**: the command exits with a clear error that lists what's missing and reminds you to run `npx ai-capabilities init` manually before rerunning (no hidden prompts).

Already-initialized projects skip the check instantly, so existing workflows keep working.

### Example CLI output

```
$ npx ai-capabilities init
[init] Project: my-app
[init] created ai-capabilities.config.json
[init] created src/app-capabilities/index.ts
[init] created src/app-capabilities/registry.ts
[init] created src/app-capabilities/capabilities/exampleCapability.ts

Next steps:
  1. Review ai-capabilities.config.json and adjust include/exclude paths for your repo.
  2. Replace src/app-capabilities/capabilities/exampleCapability.ts with a real action.
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

## MCP compatibility

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) lets AI agents discover and call tools exposed by servers. AI Capabilities works as a **capability layer on top of MCP** — extract actions from your code, add policy and risk metadata, then export them as MCP tools with **zero manual tool definitions**.

### Try the MCP server (30 seconds)

The Express example includes a ready-to-run MCP server with 7 capabilities (orders, projects, todos):

```bash
cd examples/express-app
npm install
npx @modelcontextprotocol/inspector npx tsx mcp-server.ts
```

This opens the MCP Inspector — a browser UI where you can list tools, call them interactively, and see results. No API keys needed.

### Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-capabilities-demo": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/examples/express-app/mcp-server.ts"]
    }
  }
}
```

Claude will discover all capabilities automatically and can create projects, add todos, query orders — all through natural language.

### How it works

```ts
import { buildMcpTools, CapabilityRuntime } from "ai-capabilities";
import manifest from "./output/ai-capabilities.public.json";

const tools = buildMcpTools(manifest);
// → [{ name: "api_orders_list_orders", description: "...", inputSchema: {...} }, ...]

// Register with any MCP server framework:
for (const tool of tools) {
  mcpServer.addTool(tool.name, tool.inputSchema, async (input) => {
    return runtime.execute({ capabilityId: tool.capabilityId, input });
  });
}
```

See [examples/express-app/mcp-server.ts](examples/express-app/mcp-server.ts) for the complete working implementation (~90 lines).

**Why use ai-capabilities with MCP?**
- **Zero manual tool definitions**: extract capabilities from OpenAPI specs, React hooks, and routes — `buildMcpTools()` converts them to MCP format automatically
- **Policy layer**: visibility, risk levels, and confirmation policies travel with every tool
- **Unified surface**: backend APIs and frontend UI actions are exposed through the same manifest
- **Adapters**: switch between MCP, OpenAI function calling, or Anthropic tool use without changing capability code

See [docs/adapters.md](docs/adapters.md) for all available tool format adapters.

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

1. Registers 7 capabilities (orders CRUD, projects CRUD, todos CRUD) with in-memory data.
2. Mounts the middleware in public mode with a chat UI powered by any LLM.
3. Includes an MCP stdio server (`mcp-server.ts`) for Claude Desktop / Cursor integration.
4. Uses the client SDK to discover capabilities and execute operations.

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
- Keep all executable code under `src/app-capabilities/**` (or `src/app-capabilities/auto/**` when using `auto-bind`) and register everything via `registerCapabilityDefinitions`.

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

Prefer `auto-bind` when you want to generate conservative `defineCapabilityFromExtracted` files for safe read/create operations in bulk. Use `--dry-run` to preview the plan, then review `src/app-capabilities/auto/*.ts` before registering them.

Then register the generated capability in `src/app-capabilities/registry.ts` and wire it into your runtime/chat surface.

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
3. The CLI creates `src/app-capabilities/capabilities/createProjectCapability.ts`:
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
