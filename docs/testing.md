# Testing strategy

Тесты защищают ключевые контракты и golden артефакты. Используется Vitest (`npm test`).

## Категории
- **Unit** — отдельные модули (validators, extractors) без побочных эффектов (`src/utils`, `src/extractors/*`).
- **Contract** — соответствие manifest/adapters/policy контракту (`src/manifest/manifest.contract.test.ts`, `src/adapters/model-tools.test.ts`).
- **Integration** — end-to-end сценарии (HTTP server, pilot runner).
- **Snapshot/Golden** — сравнение с `fixtures/golden/demo-app/*.json` и текстовыми summary.
- **Docs consistency** — проверяет, что README и docs присутствуют и ссылаются на актуальные скрипты.

## Golden артефакты
Находятся в `fixtures/golden/demo-app/` и включают:
- все manifest файлы,
- adapter outputs,
- well-known response,
- pilot report/summary.
Любое изменение контракта должно сопровождаться обновлением этих файлов и соответствующих тестов.

## Нормализация нестабильных полей
`normalizeForSnapshot` и `normalizeTextSnapshot` заменяют `generatedAt`, `traceId`, абсолютные пути на стабильные маркеры. Это позволяет обновлять golden только при реальных изменениях структуры, а не из-за часов или временных каталогов.

## Команды
```bash
npm test                 # полный набор Vitest тестов
./node_modules/.bin/vitest run path/to/test.ts  # точечный прогон
```

## Когда обновлять golden
1. Изменился контракт manifest/adapters/server.
2. Добавили новую capability в demo fixture.
3. Изменили структуру pilot отчёта.
Перед обновлением убедитесь, что изменения ожидаемые и отражены в документации.

## Быстрая проверка
- `npm run build` — TypeScript компиляция.
- `npm test` — гарантирует, что docs/README ссылки и CLI команды актуальны (см. `src/docs/docs-consistency.test.ts`).
