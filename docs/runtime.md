# Runtime и binding

Runtime отвечает за безопасное исполнение capability и связывает manifest с реальными handlers.

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
- **Manual registry (по умолчанию):** вызываем `registry.register("capability.id", handler)` при инициализации runtime.
- **HTTP binding (todo):** handler вызывает внешние API, используя `execution.endpoint` из manifest.
- **Комбинированные:** можно регистрировать разные handlers для одного capability в зависимости от окружения.

## Ошибки и policy
- `POLICY_DENIED` — visibility mismatch, отсутствуют permission scopes или `allowDestructive=false` при `riskLevel=high`.
- `POLICY_CONFIRMATION_REQUIRED` — `confirmationPolicy` = `once/always`, а `confirmed` не передан.
- `HANDLER_NOT_FOUND` — capability есть в manifest, но не зарегистрирован handler.
- `INVALID_INPUT` — schema validation провалилась.

## Советы
- Используйте `CapabilityRegistry` в тестах для симуляции handlers (см. `src/runtime/runtime.test.ts`).
- Все handlers должны быть идемпотентными и возвращать сериализуемые данные; runtime сам добавляет traces/metrics.
- Если capability предназначен только для public режима, убедитесь, что handler не требует внутренних tokenов.
