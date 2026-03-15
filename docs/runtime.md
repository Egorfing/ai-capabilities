# Runtime и binding

Runtime отвечает за безопасное исполнение capability и связывает manifest с реальными handlers.

> Нужен обзор, как выбрать между app-local runtime, HTTP runtime и смешанными сценариями? См. [docs/mixed-scenarios.md](./mixed-scenarios.md) — там описаны сценарии A–F, decision matrix и env-паттерны.

> **Безопасный discovery.** HTTP runtime служит canonical manifest только для внутренних агентов. Чтобы включить `/.well-known/ai-capabilities.json`, нужно явно сгенерировать `output/ai-capabilities.public.json` (например, `npx ai-capabilities manifest public`). Если файл отсутствует, well-known выключен (404), а dev fallback (`--unsafe-public-fallback`) доступен только вручную.

### Manifest loader для клиентов/агентов

Когда агенту нужно просто получить актуальный manifest (локально или по HTTP), используйте `loadManifest`:

```ts
import { loadManifest } from "ai-capabilities";

const manifestResult = await loadManifest({
  runtimeUrl: process.env.AI_CAP_RUNTIME_URL,
  expectedVisibility: "internal",
  cacheTtlMs: 30_000,
});
```

- Для `expectedVisibility: "public"` helper автоматически вызывает `/capabilities?visibility=public` и проверяет, что все capability публичные.
- Для `expectedVisibility: "internal"` helper использует `/capabilities` или локальный canonical файл.
- `allowFallback` включает автоматический переход с remote на локальный файл при сетевых проблемах.
- `ManifestLoadResult` содержит `sourceKind`, `sourceDetail`, `usedFallback`, `usedCache`, `warnings`, чтобы можно было логировать или показывать пользователю.

### Authored overrides vs. manifest

Когда capability определён через `defineCapability`, его описание (schema/policy/metadata) может отличаться от того, что записано в canonical manifest. `CapabilityRuntime` применяет простые, предсказуемые правила:

| Field          | Source of truth at runtime                                                                 |
| -------------- | ------------------------------------------------------------------------------------------ |
| `execute`      | Всегда из authored capability (handler в registry).                                        |
| `inputSchema`  | Если authored определение задаёт schema — полная замена manifest, иначе используется manifest. |
| `outputSchema` | Аналогично `inputSchema`: authored → replace, иначе manifest.                              |
| `policy`       | Shallow merge: manifest policy → поверх накладываются authored поля (visibility/risk/confirmation). |
| `metadata`     | Shallow merge: manifest metadata → поверх authored ключи (nested объекты не мерджатся рекурсивно). |
| Остальные поля | Берутся из manifest, чтобы discovery/public snapshots оставались каноничными.              |

Runtime логирует `console.warn` о том, какие поля были переопределены (warning можно перехватить собственным логгером, если нужно). Если authored capability не задаёт конкретное поле, runtime по-прежнему опирается на manifest. Это значит, что regeneration `output/ai-capabilities.json` всё ещё нужен для discovery, но во время исполнения source of truth — authored DSL.

## Основные компоненты
- **`CapabilityRegistry`** (`src/runtime/capability-registry.ts`) — map `capabilityId → handler`. Handler — async функция, принимающая validated input.
- **`CapabilityRuntime`** (`src/runtime/capability-runtime.ts`) — orchestration: валидация input schema, policy check, вызов handler, формирование `CapabilityExecutionResult`.
- **`BindingResolver`** (`src/binding`) — связывает capability с конкретным handler (REST call, RPC, локальный метод). В текущем MVP включён manual registry.
- **`policy-checker`** — возвращает `allowed`, `requiresConfirmation`, причины отказа.

## Execution flow
1. HTTP `POST /execute` (или внутренний вызов) формирует `CapabilityExecutionRequest`:
   ```json
   {
     "capabilityId": "api.orders.list-orders",
     "input": { "limit": 5 },
     "context": {
       "mode": "internal",
       "permissionScopes": ["orders:read"],
       "allowDestructive": false,
       "confirmed": true
     }
   }
   ```
2. Runtime находит capability в manifest.
3. `evaluatePolicy` проверяет visibility, scopes, risk level, confirmation.
4. JSON Schema validator сверяет `input` с `inputSchema`.
5. Handler выполняется (например, обёртка над REST API) и возвращает произвольный объект.
6. Runtime возвращает один из статусов:
   - `success` + `data`
   - `pending` (confirmation required)
   - `denied` (policy) — включает `error.details.reasons`
   - `error` (handler/input)

Пример `success` результата:
```json
{
  "status": "success",
  "capabilityId": "api.orders.list-orders",
  "data": { "items": [], "total": 0 },
  "durationMs": 42
}
```

## Binding стратегии
- **Manual registry (по умолчанию):** вызываем `registry.register("capability.id", handler)` при инициализации runtime. Для DX используйте `defineCapability` + `registerCapabilityDefinitions`, чтобы автоматически пронести handler из декларативного описания (см. [define-capability.md](./define-capability.md)).
- **HTTP binding (todo):** handler вызывает внешние API, используя `execution.endpoint` из manifest.
- **Комбинированные:** можно регистрировать разные handlers для одного capability в зависимости от окружения.

## Handler context
Runtime может передать произвольный объект в handler через `handlerContext`. Например, локальный агент может дать доступ к `router` или `ui` адаптерам для frontend действий:
```ts
await runtime.execute(request, {
  handlerContext: {
    router: { navigate: (path) => appRouter.push(path) },
    ui: { openModal: (id, payload) => modals.open(id, payload) },
  },
});
```
В handler это будет вторым аргументом `execute(input, ctx)`. Для рекомендаций по UI действиям см. [frontend-actions.md](./frontend-actions.md).

## Ошибки и policy
- `POLICY_DENIED` — visibility mismatch, отсутствуют permission scopes или `allowDestructive=false` при `riskLevel=high`.
- `POLICY_CONFIRMATION_REQUIRED` — `confirmationPolicy` = `once/always`, а `confirmed` не передан.
- `HANDLER_NOT_FOUND` — capability есть в manifest, но не зарегистрирован handler.
- `INVALID_INPUT` — schema validation провалилась.

## Советы
- Используйте `CapabilityRegistry` в тестах для симуляции handlers (см. `src/runtime/runtime.test.ts`).
- Все handlers должны быть идемпотентными и возвращать сериализуемые данные; runtime сам добавляет traces/metrics.
- Если capability предназначен только для public режима, убедитесь, что handler не требует внутренних tokenов.
