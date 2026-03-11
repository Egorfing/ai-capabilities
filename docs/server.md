# HTTP server

`npm run serve` поднимает тонкий транспорт поверх runtime/policy/trace. Сервер не создаёт runtime самостоятельно — зависимости передаются через `createServer`.

## Режимы
- `internal` (по умолчанию) — доступ ко всем capabilities из canonical manifest.
- `public` (`npm run serve -- --public`) — использует public manifest и автоматически выставляет runtime mode `public`.

## Endpoints
### GET /health
```json
{
  "status": "success",
  "data": {
    "status": "ok",
    "mode": "public",
    "manifestVersion": "1.0.0",
    "app": { "name": "Fixture App" },
    "timestamp": "2026-03-11T12:34:26.260Z"
  },
  "meta": { "traceId": "..." }
}
```

### GET /capabilities
- Без фильтров возвращает весь manifest (canonical или public).
- Query-параметры: `visibility`, `kind`, `capabilityId`.
- Ответ: `{ status: "success", data: { capabilities: [...] } }`.

### POST /execute
**Request**
```json
{
  "capabilityId": "api.orders.list-orders",
  "input": { "limit": 10 },
  "context": {
    "mode": "internal",
    "permissionScopes": ["orders:read"],
    "allowDestructive": false,
    "confirmed": true
  }
}
```
**Response (success)**
```json
{
  "status": "success",
  "data": { "ok": true },
  "meta": { "capabilityId": "api.orders.list-orders", "durationMs": 5 }
}
```
**Response (policy pending)** → HTTP 409, `status: "error"`, `error.code = "POLICY_CONFIRMATION_REQUIRED"`.

### GET /traces
- Читает события из `output/traces`.
- Поддерживает query `traceId`, `stage`, `level`, `capabilityId`.
- Возвращает `{ items: [...], total }`.

### GET /.well-known/ai-capabilities.json
- Публикует public manifest + discovery info.
- Ответ содержит `discovery.executionEndpoint`, `interaction` и `capabilities` (без handlerRef/metadata).

## Трассировка
- Каждый HTTP запрос получает `traceId`.
- Транспорт пишет события: `http.request`, `http.response`, `http.execute.*` и т.д., используя `createTraceWriter`.

## Ошибки
| Код | Когда |
| --- | --- |
| 400 | Невалидный payload / schema.
| 403 | Policy deny / private capability в public режиме.
| 404 | Capability или маршрут не найден.
| 409 | Confirmation pending.
| 500 | Ошибка runtime/handler.

## Запуск
```bash
npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --host 127.0.0.1 --port 4000
npm run serve -- --config ... --public # public mode
```

Сервер не включает auth/rate limiting и предназначен для локальных/внутренних сетей.
