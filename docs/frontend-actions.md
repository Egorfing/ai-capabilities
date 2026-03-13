# Frontend / UI capabilities

Frontend действия — это capabilities, которые выполняют навигацию, открывают модальные окна, запускают локальные мастера и другие UI-потоки без обязательного backend-запроса. Они описываются тем же `defineCapability`, что и серверные действия, и регистрируются в том же `CapabilityRegistry`.

> Главное правило: capability остаётся декларативным (schema + policy), а handler выполняет локальную UI-логику через переданный контекст.

## Навигация: `navigation.open-project-page`
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
      projectId: { type: "string", description: "Project identifier" }
    },
    required: ["projectId"]
  },
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none"
  },
  async execute({ projectId }, ctx) {
    ctx?.router?.navigate(`/projects/${projectId}`);
    return { navigated: true };
  }
});
```

## UI flow: `modal.open-create-chart`
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
      mode: { type: "string", enum: ["quick", "advanced"], default: "quick" }
    },
    required: ["datasetId"]
  },
  tags: ["charts", "modal"],
  exampleIntents: ["Open the chart wizard for dataset marketing_2026"],
  policy: {
    visibility: "internal",
    confirmationPolicy: "none"
  },
  async execute({ datasetId, mode }, ctx) {
    await ctx?.ui?.openModal?.("chart-create", { datasetId, mode });
    ctx?.notify?.info?.("Chart creation flow opened");
    return { opened: true };
  }
});
```

## Передача frontend-контекста
Контекст передаётся через `handlerContext` при вызове runtime:
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
      notify: { info: (msg) => toast.info(msg) }
    }
  }
);
```
`handlerContext` — произвольный объект, который вы передаёте при выполнении capability. Локальный агент (React/Vite приложение, desktop shell и т.д.) формирует его из собственных утилит (`router`, `ui`, `notify`).

## Совместимость и policy
- `kind: "ui-action"`/`"navigation"` помогает агенту понимать, что действие выполняется локально и может не требовать backend.
- `policy.visibility`, `riskLevel`, `confirmationPolicy` работают так же, как для серверных capability.
- При выборе значений опирайтесь на [docs/security-model.md](./security-model.md): UI действия обычно `visibility: "internal"`, `riskLevel: "low"`, пока вы не готовы расширять доступ.
- Поскольку handler исполняется в приложении, позаботьтесь о разрешениях (например, ограничьте public агента, если действие доступно только сотрудникам).

## Когда использовать frontend capabilities
- Навигация между разделами (dashboard → project → settings).
- Открытие модальных окон, сайдбаров, мастеров.
- Локальные состояния (фильтры, сортировки, выделение сущности).
- Подготовка UI перед серверной операцией (например, показать форму перед `projects.create`).

## Когда оставить backend capability
- Действие выполняет network-запрос или требует серверных привилегий.
- Capability уже описан extractor-ом на уровне API/форм.
- Нужно обеспечить headless исполнение через HTTP runtime.

Frontend и backend capabilities могут сосуществовать — агент выбирает нужный инструмент по `kind`, `tags` и policy.
