# Manifest и артефакты

Manifest — главный контракт между extractors, adapters, runtime и внешними агентами. Он строится в несколько стадий.

## Raw manifest — `capabilities.raw.json`
- **Источник:** `npm run extract` (`runPipeline` + `mergeCapabilities`).
- **Содержимое:** массив `RawCapability` с полями `id`, `source`, `kind`, `inputSchema`, `metadata`, diagnostics meta.
- **Назначение:** дебаг извлечения. Содержит исходные `source.filePath`, необработанные схемы и служебные метки.
- **Менять можно:** структуру raw capabilities, если меняется extractor.
- **Нельзя:** полагаться на raw manifest в runtime; он не очищен от чувствительных данных.

Пример (demo fixture):
```json
{
  "id": "api.orders.list-orders",
  "source": {
    "type": "openapi",
    "filePath": "fixtures/demo-app/openapi.json",
    "location": "GET /api/orders"
  },
  "kind": "read",
  "title": "List orders",
  "inputSchema": { "type": "object", "properties": { "limit": { "type": "integer" } } }
}
```

## Canonical manifest — `ai-capabilities.json`
- **Источник:** `buildAiCapabilitiesManifest`.
- **Назначение:** единый контракт для adapters/runtime/policy.
- **Характеристики:**
  - Поля `displayTitle`, `description`, `policy`, `execution`, `sources`, `effects` приведены к нормальной форме.
  - Содержит `diagnostics?: undefined` и `metadata` только для внутренних целей.
  - Использует overrides из `config.policy.overrides` (visibility/risk/confirmation/permissions/tags).
- **Source of truth:** canonical manifest = единственный документ, который adapters и runtime читают напрямую.

Фрагмент:
```json
{
  "id": "api.orders.list-orders",
  "kind": "read",
  "displayTitle": "List orders",
  "description": "Retrieve a paginated list of orders for the current user.",
  "inputSchema": { "type": "object", "properties": { "limit": { "type": "integer" } } },
  "policy": {
    "visibility": "public",
    "riskLevel": "low",
    "confirmationPolicy": "none",
    "permissionScope": ["orders:read"]
  },
  "sources": [{ "type": "openapi" }]
}
```

## Public manifest — `ai-capabilities.public.json`
- **Источник:** результат фильтрации canonical manifest по `policy.visibility === "public"` + sanitization.
- **Назначение:** внешний surface для discovery/well-known и будущих публичных агентов.
- **Особенности:**
  - `execution.handlerRef`, `metadata`, любые `source.filePath` вырезаются.
  - Только public capabilities.
  - Остаётся синхронным с canonical manifest по `manifestVersion`/`generatedAt`.
- **Нельзя:** добавлять поля, которые раскрывают внутренние implementation details.

## Enriched manifest — `ai-capabilities.enriched.json`
- **Источник:** `npm run enrich` / `runEnrichment` поверх canonical manifest.
- **Назначение:** UX-улучшения (aliases, example intents, display hints).
- **Гарантии:**
  - Не меняет `policy`, `inputSchema`, `execution`.
  - Может дополнять `displayTitle`, `userDescription`, `aliases`, `exampleIntents`.
  - Если enrichment не удался, capability остаётся как в canonical manifest.

Фрагмент enriched:
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

## Правила неизменности
- Canonical manifest нельзя редактировать вручную; он всегда пересобирается из raw capabilities.
- Public manifest содержит минимум полей и не должен ссылаться на handler/internal metadata.
- Enriched manifest — производная копия canonical manifest; при сомнениях нужно пересоздать canonical → enriched, а не редактировать enriched напрямую.
- Все версии manifest синхронизированы по `manifestVersion` и `generatedAt`; golden tests провалятся, если структура изменится без обновления фикстур.

## Где искать manifest
- По умолчанию (`ai-capabilities.config.json`) пишет в `./output/` рядом с конфигом.
- Pilot runner складывает артефакты в `output/` проекта и дублирует пути в `pilot-report.json` → `artifacts`.
- Demo fixture golden файлы лежат в `fixtures/golden/demo-app` — используйте их как образцы при добавлении новых полей.
