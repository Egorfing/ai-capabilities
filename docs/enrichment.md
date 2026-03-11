# Enrichment

Enrichment слой дополняет canonical manifest пользовательскими текстами и примерами, чтобы LLM-агенты лучше понимали capabilities.

## Зачем
- Добавить `userDescription`, `aliases`, `exampleIntents`, `displayTitle`, `riskLevel`/`confirmationPolicy` подсказки, если их нет в raw данных.
- Не менять структуру выполнения: `inputSchema`, `execution`, `policy.permissionScope` остаются из canonical manifest.

## Поток
1. CLI: `npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock`.
2. `runEnrichment` читает canonical manifest → итерирует capabilities.
3. Для каждой capability строится prompt (`buildEnrichmentPrompt`).
4. `ModelClient` (mock/internal) возвращает `CapabilityEnrichment` JSON.
5. `applyEnrichment` добавляет новые поля и пишет `ai-capabilities.enriched.json`.

## Model clients
| Client | Назначение | Поведение |
| --- | --- | --- |
| `mock` | Локальные тесты | Детектит `id`, строит "Handle {Name}" заголовки, примерный intent. |
| `internal` | Правила без внешнего API | Заполняет описание на основе `kind`, добавляет risk/confirmation подсказки. |
| (позже) внешние API | TBD | Добавлять осторожно; требуют отдельного ключа/трассировки. |

## Что можно/нельзя делать
- ✅ Добавлять UX-поля (display, aliases, intents, summaries).
- ✅ Записывать diagnostics, если клиент не смог обработать capability.
- ❌ Изменять `policy`, `inputSchema`, `execution`, `sources`.
- ❌ Удалять capability или менять `id`.

## Пример enriched capability
```json
{
  "id": "api.orders.list-orders",
  "displayTitle": "Handle Api Orders List Orders",
  "userDescription": "Retrieve a paginated list of orders for the current user.",
  "aliases": ["handle api orders list orders", "api.orders.list-orders"],
  "exampleIntents": ["Use api.orders.list-orders in a flow"],
  "policy": { "visibility": "public", "riskLevel": "low", "confirmationPolicy": "none" }
}
```

## Diagnostics
- Любая ошибка клиента записывается как warning через `trace` + `DiagnosticEntry`.
- Если enrichment провалился, capability копируется без изменений, чтобы downstream слои оставались консистентными.

## Советы
- Храните enriched manifest рядом с canonical → всегда можно пересоздать enriched после любой правки raw данных.
- Для внешних моделей добавляйте троттлинг и retry в своих `ModelClient` реализациях.
