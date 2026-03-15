# defineCapability helper

`defineCapability` is a lightweight DX layer that keeps schema, metadata, policy, and the handler together in a single file. It does **not** change the runtime or manifest architecture—it simply makes it easier for developers to author capabilities and register them in `CapabilityRegistry`. When you start from something that was already discovered by `inspect`/`extract` (for example `hook.create-project-mutation`), use `defineCapabilityFromExtracted`. It shares the same API but also stores the `sourceId` inside `metadata.extractedSourceId` so you never lose the link back to the original extractor result.

## Authoring standard
- **Discovery vs. execution:** `inspect`/`extract` only tell you what exists. Files created with `defineCapability*` describe what the agent is allowed to execute. Treat these helpers as the official DSL for executable capabilities.
- **Traceability:** `defineCapabilityFromExtracted` preserves `sourceId`, making it trivial to cite the original OpenAPI operation, React Query hook, etc., in manifests, docs, and AGENTS workflows.
- **Consistency:** Every capability under `src/app-capabilities/**` should use one of these helpers so schemas, policies, and handlers remain reviewable and LLM-friendly.
- **Tooling alignment:** `npx ai-capabilities scaffold` and `npx ai-capabilities auto-bind` already emit files built on top of these helpers; manual authoring should follow the same pattern.

**Philosophy:** extracted capabilities describe what the app exposes internally, while authored capabilities describe what the AI agent is trusted to execute. The helpers bridge that gap.

## When to use it
- You want schema + policy + handler co-located in a self-documented module.
- You bootstrapped via `npx ai-capabilities init` (the example already uses this helper).
- You need capabilities that are easy to review, easy to lint, and easy for LLMs to understand.

If you must control registry wiring manually (dynamic registration, custom execution engines, etc.), the low-level API remains available—you can still call `registry.register` directly.

## Basic example
```ts
import { defineCapability } from "ai-capabilities";

export const exampleEchoCapability = defineCapability({
  id: "example.echo",
  displayTitle: "Echo text",
  description: "Returns the provided text back to the caller.",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  metadata: { tags: ["example"] },
  async execute({ text }) {
    return { echoed: text, length: text.length };
  },
});
```

## Realistic mutation example (`projects.create`)
```ts
import { defineCapability } from "ai-capabilities";
import { projectApi } from "../services/projectApi";

export const projectsCreateCapability = defineCapability({
  id: "projects.create",
  displayTitle: "Create project",
  description: "Creates a workspace project and returns its identifier.",
  kind: "mutation",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 3 },
      description: { type: "string" },
    },
    required: ["name"],
  },
  outputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
    },
  },
  tags: ["projects", "workspace"],
  exampleIntents: ["Create a workspace project called Revenue Ops"],
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

## Promoting an extracted capability
`inspect` surfaced `hook.create-project-mutation`? No need to rebuild everything manually:

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

`defineCapabilityFromExtracted` automatically annotates the capability with `metadata.extractedSourceId`, so manifests, registries, and docs can always trace it back to the source hook.

### Read-capability example (`hook.projects-query`)
```ts
import { defineCapabilityFromExtracted } from "ai-capabilities";
import { projectApi } from "../services/projectApi";

export const projectsListCapability = defineCapabilityFromExtracted({
  sourceId: "hook.projects-query",
  id: "projects.list",
  displayTitle: "List projects",
  description: "Lists the visible projects for the current user.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
    },
  },
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  async execute({ limit = 20 }: { limit?: number }) {
    return projectApi.list({ limit });
  },
});
```

## CLI scaffolding
When `inspect`/`extract` highlight a candidate, run:

```bash
npx ai-capabilities scaffold --id hook.create-project-mutation
```

Useful flags:
- `--manifest ./output/ai-capabilities.json` – point to a specific canonical manifest.
- `--dir ./src/app-capabilities/capabilities` – choose the output directory.

The command creates a file such as `createProjectCapability.ts` that already uses `defineCapabilityFromExtracted`, copies over `displayTitle`/`description`/`schemas`, sets `metadata.extractedSourceId`, and leaves a clear `TODO` inside `execute`.

After scaffolding:
1. Update `id` to the canonical identifier (`projects.create`).
2. Implement the handler.
3. Register the capability via `registerCapabilityDefinitions`.

## Registering with the runtime
```ts
import { CapabilityRegistry, registerCapabilityDefinitions } from "ai-capabilities";
import { capabilities } from "./ai-capabilities";

const registry = new CapabilityRegistry();
registerCapabilityDefinitions(registry, capabilities);
```

`registerCapabilityDefinitions` simply loops through every helper definition and calls `registry.register(id, handler)`, so existing bindings remain compatible.

### Passing `handlerContext`
```ts
await runtime.execute(request, {
  handlerContext: {
    router: { navigate: (path) => appRouter.push(path) },
    ui: { openModal: (id, payload) => modals.open(id, payload) },
  },
});
```

The object you provide becomes the second argument of every `execute` handler. See [docs/frontend-actions.md](./frontend-actions.md) for adapter details. Need help filling schemas or metadata? Use the prompts in [docs/llm-prompt.md](./llm-prompt.md) or run `npx ai-capabilities prompt`.

## Field reference
| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Canonical capability identifier. |
| `displayTitle` | Yes | Human-readable title shown to agents and UI. |
| `description` | Yes | Short explanation of the action. |
| `inputSchema` | Yes | JSON Schema describing the input payload. |
| `outputSchema` | No | JSON Schema of the response (useful for typed clients). |
| `aliases` / `exampleIntents` | No | Help LLMs understand additional phrasings. |
| `tags` | No | Thematic grouping labels. |
| `policy` | No | `visibility`, `riskLevel`, `confirmationPolicy`. |
| `metadata` | No | Arbitrary fields for downstream tooling. |
| `execute` | Yes | Async handler that receives validated input. |

## When to drop to the low-level API
- You need a custom lifecycle for registering handlers.
- Capabilities are generated entirely by an extractor.
- You require bespoke schema/metadata formats.

The helper does not block these cases—just skip it and continue to call `registry.register(...)` directly.

> Need policy guidance? Follow [docs/policy.md](./policy.md) for recommended values (`visibility`, `riskLevel`, `confirmationPolicy`) and rollout practices.
