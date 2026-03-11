# Pilot runner

Pilot runner orchestrates extraction → manifest → enrichment → report для реального приложения и фиксирует результат.

## Как запустить
```bash
npm run pilot -- \
  --project ../real-app \
  --config ../real-app/ai-capabilities.config.json \
  --with-enrich \
  --report-dir ../real-app/output/pilot
```
Аргументы:
- `--project` — путь к целевому проекту (переопределяет `config.project.root`).
- `--config` — явный конфиг (если не указан, ищется относительно CWD).
- `--with-enrich` — дополнительно запускает enrichment.
- `--report-dir` — куда сохранить `pilot-report.json` и `pilot-summary.md` (по умолчанию рядом с canonical manifest).

## Что происходит
1. Загружается конфиг, резолвятся пути и output директории.
2. `runCompatibilityChecks` удостоверяется, что проект/tsconfig/spec пути существуют.
3. Extraction pipeline генерирует raw manifest и diagnostics.
4. Canonical/public manifest записываются согласно конфигу.
5. (опционально) Enrichment создаёт `ai-capabilities.enriched.json`.
6. Diagnostics + unsupported patterns агрегируются.
7. Пишутся отчёты + трассировки.

## Артефакты
`pilot-report.json` (machine-readable) и `pilot-summary.md` (Markdown). Пример summary:
```
# Pilot Summary
- **Status:** success
- **Project:** <repo>/fixtures/demo-app
- **Config:** <tmp>
- **Started:** __SNAPSHOT_TIMESTAMP__
- **Finished:** __SNAPSHOT_TIMESTAMP__
- **Trace ID:** __SNAPSHOT_ID__
...
```
Report включает поля:
- `status`: `success`, `partial`, `failed`.
- `summary.capabilitiesTotal` / `publicCapabilities`.
- `diagnostics` count.
- `extractors[]` со статусом каждого extractor.
- `compatibility.errors/warnings`.
- `artifacts` с относительными путями к manifest/trace/report файлам.
- `unsupportedPatterns`: массив нормализованных warning сообщений.

## Статусы
- **Success** — extraction/manifest завершены, ошибок нет.
- **Partial** — manifest создан, но есть warnings/errors (например, enrichment не прошёл).
- **Failed** — совместимость не пройдена или extraction упал до создания manifest.

## Как читать unsupported patterns
- Список строится из diagnostics с ключевыми словами `unsupported`/`not supported`.
- Используйте его как backlog для следующих этапов — либо расширяйте extractors, либо документируйте ограничения.

## Советы
- Храните отчёты в репозитории проекта → проще отслеживать прогресс пилота.
- Для CI: запускайте `npm run pilot` в `--report-dir artifacts/pilot` и архивируйте каталог целиком (manifest + traces).
- Golden regression (`src/pilot/pilot-regression.test.ts`) гарантирует, что demo fixture остаётся стабильным — обновляйте фикстуры только если меняете контракт осознанно.
