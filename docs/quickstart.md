# Quickstart

Запустите минимальный сценарий полностью локально на demo-проекте.

## 0. Подготовка
```bash
npm install
npm run build
npm run test
npx ai-capabilities init
```
`init` создаёт `ai-capabilities.config.json` и папку `src/ai-capabilities/` (index, registry и exampleCapability), чтобы дальше можно было сразу запускать extract/enrich.
Пример внутри использует `defineCapability`, поэтому schema, metadata и handler находятся в одном файле — см. [docs/define-capability.md](./define-capability.md). Для UI/навигационных действий ориентируйтесь на [docs/frontend-actions.md](./frontend-actions.md), а чтобы заполнить недостающие поля через Cursor/Claude, используйте промпты из [docs/llm-prompt.md](./llm-prompt.md) или `npx ai-capabilities prompt`.

## 1. Извлечь capabilities
```bash
npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json
```
Результат: `output/capabilities.raw.json` + diagnostics.

## 2. Сгенерировать canonical/public manifest
После extraction manifest автоматически пишется в `output/ai-capabilities.json` и `output/ai-capabilities.public.json`.

## 3. Обогатить manifest
```bash
npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock
```

## 4. Поднять сервер
```bash
npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000
```
Endpoints:
- `GET http://127.0.0.1:4000/health`
- `GET http://127.0.0.1:4000/capabilities`
- `POST http://127.0.0.1:4000/execute`
- `GET http://127.0.0.1:4000/.well-known/ai-capabilities.json`

## 5. Запустить pilot run (опционально)
```bash
npm run pilot -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json --with-enrich
```
Это создаст `pilot-report.json` и `pilot-summary.md` с результатами.

## 6. Проверить интеграцию через doctor
```bash
npx ai-capabilities doctor
```
Команда выдаст отчёт о готовности проекта (конфиг, артефакты, наличие executable capabilities) и подскажет следующие шаги. См. [docs/doctor.md](./doctor.md) для примеров.

Готовы подключить UI? Следуйте [docs/happy-path.md](./happy-path.md) и скопируйте пример из `examples/react-app`. Если что-то идёт не так (unbound capabilities, пустые schema, контекст UI), загляните в [docs/faq.md](./faq.md) — там перечислены симптомы и быстрые фиксы.
