# Model adapters

Adapters конвертируют `AiCapabilitiesManifest` в форматы конкретных LLM API.

## Общие правила
- `buildModelToolDefinitions` создаёт универсальный список с `capabilityId`, `name`, `description`, `inputSchema` — его используют все клиенты.
- Любой adapter обязан:
  - Сохранять `capabilityId` → downstream runtime может сопоставить вызов и handler.
  - Использовать `inputSchema` без изменения типа/required.
  - Встраивать `policy.riskLevel/confirmationPolicy` в описание или metadata, если API это поддерживает.

## Адаптеры
| Adapter | Файл | Формат | Особенности |
| --- | --- | --- | --- |
| Universal | `buildModelToolDefinitions` | внутренний JSON | Используется для тестов/golden, содержит минимальный набор полей. |
| OpenAI | `buildOpenAITools` | `[{ type: "function", function: { name, description, parameters }}]` | `name` нормализуется (точки → `_`), `parameters` = JSON Schema. |
| Anthropic | `buildAnthropicTools` | `{ name, description, input_schema }[]` | следит за snake_case и передаёт `displayTitle` в описание. |
| Internal | `buildInternalTools` | `{ id, capabilityId, summary, schema }[]` | summary включает risk/confirmation hints, используется внутренним planner/runtime. |
| Mock | `buildMockTools` | `{ name: "mock_...", capabilityId, schema }[]` | полезен для тестирования UI/tool picker. |

## Пример (OpenAI)
```json
{
  "type": "function",
  "capabilityId": "api.orders.list-orders",
  "function": {
    "name": "api_orders_list_orders",
    "description": "Retrieve a paginated list of orders for the current user.",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": { "type": "integer", "default": 20 },
        "status": { "type": "string", "enum": ["cancelled", "delivered", "pending", "shipped"] }
      }
    }
  }
}
```

## Гарантии adapter layer
- Не меняет `inputSchema` типы; максимум добавляет описания.
- Не скрывает capability без явной причины (например, visibility ≠ public для public adapter).
- Любые breaking changes должны сопровождаться обновлением golden файлов `fixtures/golden/demo-app/adapters.*.json` и теста `src/adapters/model-tools.test.ts`.
