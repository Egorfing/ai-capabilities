# Quickstart

Запустите минимальный сценарий полностью локально на demo-проекте.

## 0. Подготовка
```bash
npm install
npm run build
npm run test
```

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
