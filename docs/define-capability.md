# defineCapability helper

`defineCapability` — тонкий слой DX, который объединяет схему, metadata и handler в одном файле. Он не меняет runtime/manifest архитектуру, а помогает разработчикам быстрее описать capability и зарегистрировать её в `CapabilityRegistry`. Для случаев, когда вы начинаете с уже извлечённого хука (`hook.create-project-mutation`), используйте `defineCapabilityFromExtracted` — он повторно использует все поля helper-а, но дополнительно сохраняет `sourceId` в `metadata.extractedSourceId`, чтобы вы никогда не потеряли связь с исходной находкой `inspect/extract`.

## Authoring standard
- **Discovery vs execution:** `inspect`/`extract` tell you what exists, but only `defineCapability*` files describe what the agent is allowed to execute. Treat these helpers as the official DSL for executable capabilities.
- **Traceability:** `defineCapabilityFromExtracted` keeps `sourceId` so you can cite the original hook (openapi operation, React Query hook, etc.) inside manifests, documentation, and AGENTS workflows.
- **Consistency:** Every capability under `src/app-capabilities/**` should follow one of these helpers so schemas, policies, and handlers stay reviewable and easy for LLMs to understand.
- **Tooling:** `npx ai-capabilities scaffold` and `npx ai-capabilities auto-bind` both emit files that already use these helpers; adopt the same pattern for manual authoring.

Philosophy: extracted capabilities describe *what the app exposes internally*, whereas authored capabilities describe *what the AI agent is trusted to execute*. The helpers bridge that gap.

## Когда использовать
- вы описываете capability вручную и хотите держать schema + policy + handler рядом;
- вы scaffold-ите проект через `npx ai-capabilities init` (пример уже использует helper);
- вы хотите создать self-documented capability, понятную LLM и коллегам.

Если вам нужно вручную управлять registry/handlers (например, динамическая регистрация или нестандартные execution стратегии) — низкоуровневый API остаётся доступным.

## Базовый пример
```ts
import { defineCapability } from "ai-capabilities";

export const exampleEchoCapability = defineCapability({
  id: "example.echo",
  displayTitle: "Echo text",
  description: "Returns the provided text back to the caller.",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"]
  },
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none"
  },
  metadata: { tags: ["example"] },
  async execute({ text }) {
    return { echoed: text, length: text.length };
  }
});
```

## Реалистичный пример (`projects.create`)
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
      description: { type: "string" }
    },
    required: ["name"]
  },
  outputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" }
    }
  },
  tags: ["projects", "workspace"],
  exampleIntents: ["Create a workspace project called Revenue Ops"],
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once"
  },
  async execute({ name, description }) {
    return projectApi.create({ name, description });
  }
});
```

## Промоут извлечённой capability
Если `inspect` показал `hook.create-project-mutation`, не нужно переписывать всё с нуля:

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

`defineCapabilityFromExtracted` автоматически добавляет `metadata.extractedSourceId`, благодаря чему любой runtime/manifest/документация могут отследить связь с исходным hook'ом.

### Read-capability пример (`hook.projects-query`)
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
      limit: { type: "number", minimum: 1, maximum: 100, default: 20 }
    }
  },
  policy: {
    visibility: "internal",
    riskLevel: "low",
    confirmationPolicy: "none"
  },
  async execute({ limit = 20 }: { limit?: number }) {
    return projectApi.list({ limit });
  }
});
```

## Генерация scaffold через CLI
Когда `inspect`/`extract` показывают нужный hook, запустите:
```bash
npx ai-capabilities scaffold --id hook.create-project-mutation
```
Опциональные флаги:
- `--manifest ./output/ai-capabilities.json` — использовать конкретный canonical manifest.
- `--dir ./src/app-capabilities/capabilities` — контролировать директорию для файлов.

Команда создаёт файл вроде `createProjectCapability.ts`, сразу подключает `defineCapabilityFromExtracted`, копирует `displayTitle`/`description`/`schema`, добавляет `metadata.extractedSourceId` и оставляет `execute` с понятным TODO. После генерации:
1. Обновите `id` на канонический (`projects.create`).
2. Допишите `execute`.
3. Зарегистрируйте capability через `registerCapabilityDefinitions`.

## Регистрация в runtime
```ts
import { CapabilityRegistry, registerCapabilityDefinitions } from "ai-capabilities";
import { capabilities } from "./ai-capabilities";

const registry = new CapabilityRegistry();
registerCapabilityDefinitions(registry, capabilities);
```
`registerCapabilityDefinitions` всего лишь вызывает `registry.register(id, handler)` для каждого helper-определения, поэтому любые существующие биндинги останутся совместимыми.

### Передача handlerContext
Когда runtime исполняет capability, можно передать UI-контекст:
```ts
await runtime.execute(request, {
  handlerContext: {
    router: { navigate: (path) => appRouter.push(path) },
    ui: { openModal: (id, payload) => modals.open(id, payload) },
  },
});
```
Этот объект доступен внутри `execute` (второй параметр). Для подробностей см. [frontend-actions.md](./frontend-actions.md). Если нужно быстро заполнить схему/metadata с помощью coding assistant, воспользуйтесь промптами и CLI helper из [docs/llm-prompt.md](./llm-prompt.md) или командой `npx ai-capabilities prompt`.

## Поля определения
| Поле | Обязательное | Описание |
| ---- | ------------ | -------- |
| `id` | да | Канонический идентификатор capability. |
| `displayTitle` | да | Человеко-понятный заголовок (используют агенты и UI). |
| `description` | да | Короткое описание действия. |
| `inputSchema` | да | JSON Schema входа. |
| `outputSchema` | нет | JSON Schema ответа (если хотите строгую типизацию). |
| `aliases` / `exampleIntents` | нет | Помогают LLM понять назначение capability. |
| `tags` | нет | Тематические метки. |
| `policy` | нет | `visibility`, `riskLevel`, `confirmationPolicy`. |
| `metadata` | нет | Любые дополнительные поля для downstream процессов. |
| `execute` | да | Handler, принимающий валидированный input. |

## Когда опускаться на низкий уровень
- Нужен кастомный жизненный цикл регистрации handlers.
- Capability создаётся автоматически extractor-ом.
- Требуется собственный формат schema/metadata.

Helper не блокирует эти сценарии — просто не используйте его и продолжайте вызывать `registry.register(...)` напрямую.

> Need guidance on which policy values to choose? Follow the recommendations in [docs/security-model.md](./security-model.md) — it defines visibility, risk levels, confirmation policies, and the safe pilot rollout flow.
