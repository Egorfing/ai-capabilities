# Frontend / UI capabilities

Frontend capabilities cover navigation, modal launches, wizards, and other in-app flows that do not require a backend call. They use the same `defineCapability` helper as server-side actions and are registered in the same `CapabilityRegistry`.

> Core rule: keep the capability declarative (schema + policy). The handler performs UI logic using the provided context.

## Navigation example: `navigation.open-project-page`
```ts
import { defineCapability } from "ai-capabilities";

export const openProjectPage = defineCapability({
  id: "navigation.open-project-page",
  kind: "ui-action",
  displayTitle: "Open project page",
  description: "Navigates to the selected project page inside the app",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project identifier" },
    },
    required: ["projectId"],
  },
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none",
  },
  async execute({ projectId }, ctx) {
    ctx?.router?.navigate(`/projects/${projectId}`);
    return { navigated: true };
  },
});
```

## UI flow example: `modal.open-create-chart`
```ts
import { defineCapability } from "ai-capabilities";

export const openCreateChart = defineCapability({
  id: "modal.open-create-chart",
  kind: "ui-action",
  displayTitle: "Open chart creation flow",
  description: "Opens the chart creation modal prefilled with the dataset",
  inputSchema: {
    type: "object",
    properties: {
      datasetId: { type: "string" },
      mode: { type: "string", enum: ["quick", "advanced"], default: "quick" },
    },
    required: ["datasetId"],
  },
  tags: ["charts", "modal"],
  exampleIntents: ["Open the chart wizard for dataset marketing_2026"],
  policy: {
    visibility: "internal",
    confirmationPolicy: "none",
  },
  async execute({ datasetId, mode }, ctx) {
    await ctx?.ui?.openModal?.("chart-create", { datasetId, mode });
    ctx?.notify?.info?.("Chart creation flow opened");
    return { opened: true };
  },
});
```

## Passing frontend context

Context is delivered through `handlerContext` when executing the runtime:

```ts
import { CapabilityRuntime } from "ai-capabilities";
import { registry, manifest } from "./ai";

const runtime = new CapabilityRuntime({ manifest, registry });

await runtime.execute(
  { capabilityId: "navigation.open-project-page", input: { projectId: "proj_42" } },
  {
    handlerContext: {
      router: { navigate: (path) => appRouter.push(path) },
      ui: { openModal: (id, payload) => modals.open(id, payload) },
      notify: { info: (msg) => toast.info(msg) },
    },
  },
);
```

`handlerContext` is any object you pass when executing a capability. Local agents (React/Vite apps, desktop shells, etc.) assemble it from their own utilities (`router`, `ui`, `notify`).

## Compatibility & policy considerations
- `kind: "ui-action"` / `"navigation"` helps agents understand the action runs locally and might not need backend access.
- `policy.visibility`, `riskLevel`, `confirmationPolicy` behave exactly like they do for server-side capabilities.
- Follow [docs/policy.md](./policy.md) for guidance: UI actions usually stay `visibility: "internal"`, `riskLevel: "low"` until you are ready to expose them.
- Because the handler runs inside the app, be mindful of permissions (e.g., limit public agents if the action is employee-only).

## When to prefer frontend capabilities
- Navigating between sections (dashboard → project → settings).
- Opening modals, sidebars, wizards.
- Managing local state (filters, sorting, entity selection).
- Preparing UI before a server operation (e.g., show a form before `projects.create`).

## When backend capabilities are better
- The action performs network calls or needs server privileges.
- The capability already exists via an extractor (OpenAPI, forms, etc.).
- You need headless execution over HTTP runtime.

Frontend and backend capabilities can coexist—agents can choose tools based on `kind`, `tags`, and policy.
