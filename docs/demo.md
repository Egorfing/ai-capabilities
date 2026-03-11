# Demo walkthrough

`fixtures/demo-app` — это пример React/TypeScript проекта, покрывающий OpenAPI, React Query, Router и Form паттерны.

## Быстрый сценарий
1. **Extraction**
   ```bash
   npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json
   ```
   - Raw capabilities → `output/capabilities.raw.json`.
   - Diagnostics → `output/diag*.log`.

2. **Manifest build**
   - Canonical/public файлы появляются в `output/ai-capabilities.json` и `output/ai-capabilities.public.json`.
   - Golden версии лежат в `fixtures/golden/demo-app/`.

3. **Enrichment**
   ```bash
   npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock
   ```
   - UX-поля сохраняются рядом с canonical manifest.

4. **Runtime / Server**
   ```bash
   npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000
   ```
   - Проверьте `GET /.well-known/ai-capabilities.json` — увидите публичные capabilities.
   - `POST /execute` можно вызвать с `capabilityId="api.orders.list-orders"`.

5. **Pilot**
   ```bash
   npm run pilot -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json --with-enrich
   ```
   - Результаты: `pilot-report.json`, `pilot-summary.md`, traces.

## Что смотреть в коде
- `fixtures/demo-app/openapi.json` — OpenAPI spec.
- `fixtures/demo-app/src/hooks` — React Query extractors.
- `fixtures/demo-app/src/router` — маршруты → navigation capabilities.
- `fixtures/golden/demo-app` — эталонные артефакты для regression tests.
