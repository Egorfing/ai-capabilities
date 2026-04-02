# Model adapters

Adapters convert `AiCapabilitiesManifest` entries into formats expected by specific LLM APIs.

## General rules
- `buildModelToolDefinitions` produces a universal list containing `capabilityId`, `name`, `description`, and `inputSchema`; every client derives from it.
- Each adapter must:
  - Preserve `capabilityId` so downstream runtimes can match the call to the handler.
  - Use the JSON Schema as-is (type/required fields must remain intact).
  - Surface `policy.riskLevel` / `confirmationPolicy` in the description or metadata when the target API supports it.

## Adapters

| Adapter | File | Target format | Notes |
| --- | --- | --- | --- |
| Universal | `buildModelToolDefinitions` | Internal JSON | Used for tests/golden files; contains the minimal field set. |
| OpenAI | `buildOpenAITools` | `[{ type: "function", function: { name, description, parameters }}]` | Normalizes `name` (dots → `_`); `parameters` is straight JSON Schema. |
| Anthropic | `buildAnthropicTools` | `{ name, description, input_schema }[]` | Ensures snake_case naming and carries `displayTitle` into the description. |
| Internal | `buildInternalTools` | `{ id, capabilityId, summary, schema }[]` | Summary includes risk/confirmation hints; used by the internal planner/runtime. |
| MCP | `buildMcpTools` | `{ name, description, inputSchema }[]` | [Model Context Protocol](https://modelcontextprotocol.io) compatible; register tools with any MCP server framework. |
| Mock | `buildMockTools` | `{ name: "mock_...", capabilityId, schema }[]` | Handy for testing UI/tool pickers. |

## Example (OpenAI)

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

## Adapter-layer guarantees

- Do not change data types in `inputSchema`; adding descriptions is fine.
- Do not hide capabilities unless explicitly required (e.g., `visibility !== public` for public adapters).
- Any breaking change must update the golden files under `fixtures/golden/demo-app/adapters.*.json` and the test `src/adapters/model-tools.test.ts`.
