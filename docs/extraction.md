# Extraction pipeline

Extraction преобразует исходный код и спецификации в `RawCapability` объекты.

## Поддерживаемые extractors
| Extractor | Источник | Основные поля | Ограничения |
| --- | --- | --- | --- |
| `openapi` | `openapi.json/yaml` | method, path, parameters, requestBody → `inputSchema`, responses → `outputSchema` | Требуются operationId или tag+path для стабильных id. |
| `react-query` | hooks, `useQuery`/`useMutation` вызовы | Хватает `key`, `variables` | Кастомные wrappers, динамические query keys фиксируются как diagnostics. |
| `router` | маршруты (React Router, JSX) | `kind = navigation`, `metadata.navigation.route` | Вложенные динамические слои описываются поверхностно. |
| `form` | формы/валидация | `inputSchema` из form definition | Кастомные валидаторы описываются как предупреждения. |

## Конфиг
`ai-capabilities.config.json` определяет проект и extractors:
```json
{
  "project": { "root": "../../demo-app", "tsconfig": "../../../tsconfig.json" },
  "extractors": {
    "openapi": { "spec": "../../demo-app/openapi.json" },
    "reactQuery": { "include": ["src/hooks/**"], "tsconfig": "../../../tsconfig.json" }
  }
}
```
- `paths.include/exclude` влияют на все extractors.
- Каждый extractor может задавать свои include/exclude.
- Все пути резолвятся относительно файла конфига.

## Pipeline шаги
1. `ExtractorRegistry` собирает зарегистрированные extractors (`src/extractors/index.ts`).
2. `runPipeline` прогоняет каждый extractor, собирает `capabilities`, diagnostics и список `extractorsRun`.
3. `schema-normalizer` ограничивает глубину (`config.schema.maxDepth`) и помечает усечённые узлы.
4. `mergeCapabilities` объединяет способности с одинаковым `id` (приоритет — более конкретные источники).
5. Результат пишется в `capabilities.raw.json`, diagnostics — в `output/diag*.log`.

## Diagnostics
Diagnostics — это `DiagnosticEntry` с `level`, `stage`, `message`, `sourceType`.
- **Info:** служебные метки (например, «Processed openapi.json»).
- **Warning:** неполные схемы, пропущенные файлы, unsupported patterns.
- **Error:** extractor упал, но pipeline продолжает работу.
- `collectUnsupportedPatterns` агрегирует сообщения с ключевыми словами для pilot отчёта.

## Почему capability могла не появиться
- Не попала под `paths.include` или была исключена.
- Extractor сработал, но выдал warning «unsupported custom hook pattern» → посмотрите diagnostics.
- Поле `visibility` переопределено в `config.policy.overrides` на `internal`, поэтому capability не попала в public manifest (но есть в canonical).
- Schema обрезана из-за `schema.maxDepth` и требует ручного уточнения.

## Troubleshooting
- Запустите `npm run extract -- --project <path> --config <config>` и откройте `output/capabilities.raw.json` + `output/diag*.log`.
- Включите только один extractor через `runPipeline(..., { only: ["openapi"] })` (параметр доступен в коде) и добавьте тесты для конкретного кейса.
- Используйте `fixtures/golden/demo-app` как эталон: если новая capability ломает golden, пересмотрите `id` и `inputSchema`.
