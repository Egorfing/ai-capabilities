# Demo walkthrough

`fixtures/demo-app` — это пример React/TypeScript проекта, покрывающий OpenAPI (3.x), React Query, Router и Form паттерны.

Перед запуском остальных шагов выполните:
```bash
npx ai-capabilities init
```
Команда создаст стартовый `ai-capabilities.config.json` и папку `src/app-capabilities/` с registry + example capability, которые можно адаптировать под demo или свой проект.
Определения используют `defineCapability`, поэтому переносить код между демо и реальным приложением просто (см. [define-capability.md](./define-capability.md)) и дополнительно [frontend-actions.md](./frontend-actions.md) для UI/навигационных кейсов.

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

6. **Doctor (диагностика)**
   ```bash
   npx ai-capabilities doctor
   ```
   Получите краткий отчёт о конфиге, артефактах и готовности к пилоту. Подробности — [docs/doctor.md](./doctor.md).

Если хотите увидеть полный UI-поток, изучите [examples/react-app](../examples/react-app) и [docs/happy-path.md](./happy-path.md).

## Что смотреть в коде
- `fixtures/demo-app/openapi.json` — OpenAPI spec (Swagger 2.0 fixtures live in `fixtures/swagger/`).
- `fixtures/demo-app/src/hooks` — React Query extractors.
- `fixtures/demo-app/src/router` — маршруты → navigation capabilities.
- `fixtures/golden/demo-app` — эталонные артефакты для regression tests.
