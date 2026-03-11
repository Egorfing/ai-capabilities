# Contributing

Этот документ описывает, как расширять платформу, не ломая существующие контракты.

## Общие правила
1. Всегда запускайте `npm test` перед PR — golden/contract тесты сразу покажут регрессии.
2. Обновляйте соответствующие docs, когда добавляете новый слой или флаг CLI.
3. Любые изменения manifest/adapters/policy требуют обновления golden fixtures.

## Добавление extractor
1. Создайте файл в `src/extractors/<name>.ts` и экспортируйте `Extractor` с `name`, `sourceType`, `extract`.
2. Зарегистрируйте его в `src/extractors/index.ts` (попадёт в `defaultRegistry`).
3. Возвращайте diagnostics (`DiagnosticEntry`) вместо throw, когда возможно.
4. Добавьте тесты в `src/extractors/<name>.test.ts` + при необходимости fixtures.
5. Обновите `docs/extraction.md`, описав новый источник и ограничения.

## Добавление adapter
1. Реализуйте функцию в `src/adapters/model-tools/` (см. существующие примеры).
2. Используйте `buildModelToolDefinitions` как основу.
3. Покройте тестами в `src/adapters/model-tools.test.ts`, обновите golden outputs (`fixtures/golden/demo-app/adapters.*.json`).
4. Документируйте формат в `docs/adapters.md`.

## Новая policy rule
1. Добавьте правило в `src/policy/policy-checker.ts` (в конец списка, чтобы сохранить предсказуемость).
2. Обновите `src/policy/policy-checker.test.ts` с happy/deny кейсами.
3. При необходимости добавьте новые override параметры в `config/types` и опишите в `docs/policy.md`.

## Handler binding стратегия
1. Реализуйте новую стратегию в `src/binding` (например, маппинг REST endpoint → capability).
2. Не смешивайте binding и runtime: runtime остаётся transport-agnostic.
3. Добавьте интеграционный тест (`src/runtime/...` или `src/server/...`), который показывает новый binding.

## Работа с docs и тестами
- README должен ссылаться на ключевые docs — проверяется тестом `docs-consistency`.
- При добавлении CLI команды убедитесь, что `package.json` содержит соответствующий script, а README обновлён.
- Golden файлы обновляйте через `npm run pilot` на demo fixture и копируйте артефакты в `fixtures/golden/demo-app`.
