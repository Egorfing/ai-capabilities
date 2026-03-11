# External agents surface

AI Capabilities allows external agents to discover and execute application actions through a public capability manifest and well-known discovery endpoint.

Внешние агенты взаимодействуют только с публичными артефактами: public manifest и well-known endpoint.

## Public manifest
- Файл: `ai-capabilities.public.json`.
- Содержит только capabilities с `policy.visibility = "public"`.
- Поля `execution.handlerRef`, `metadata`, пути источников удалены.
- Используется server-ом для `GET /capabilities` в public режиме и для генерации well-known ответа.

## Well-known endpoint
- URL: `/.well-known/ai-capabilities.json`.
- Строится функцией `buildWellKnownResponse` и содержит:
```json
{
  "manifestVersion": "1.0.0",
  "generatedAt": "2026-03-11T12:34:26.260Z",
  "app": { "name": "Fixture App", "version": "0.0.1" },
  "discovery": {
    "mode": "public",
    "executionEndpoint": { "method": "POST", "path": "/execute" },
    "capabilitiesEndpoint": { "method": "GET", "path": "/capabilities" }
  },
  "policy": {
    "defaultVisibility": "internal",
    "defaultRiskLevel": "medium",
    "defaultConfirmationPolicy": "none",
    "confirmationSupported": false
  },
  "interaction": {
    "toolCalling": true,
    "httpExecution": true,
    "streaming": false
  },
  "capabilities": [
    {
      "id": "api.orders.list-orders",
      "kind": "read",
      "displayTitle": "List orders",
      "inputSchema": { "type": "object", "properties": { "limit": { "type": "integer" } } },
      "execution": { "mode": "http", "endpoint": { "method": "POST", "path": "/execute" } },
      "policy": { "visibility": "public", "riskLevel": "low", "confirmationPolicy": "none" }
    }
  ]
}
```

## Execution endpoint reference
- Все capabilities в well-known ссылаются на тот же `POST /execute`.
- Агент обязан передавать `capabilityId` + `input` из schema.
- Public mode автоматически запрещает destructive запросы (`allowDestructive=false`).

## Скрытые данные
- handler references, diagnostics, путь к исходникам, приватные tags не публикуются.
- Если capability требует внутренних permission scopes, она остаётся только в canonical manifest.

## Поток для внешнего агента
1. GET `/.well-known/ai-capabilities.json` → получить manifestVersion, доступные capabilities, interaction hints.
2. GET `/capabilities?visibility=public` при необходимости получить полные схемы.
3. POST `/execute` с `context.mode="public"`.
4. Интерпретировать `status`/`error` поля; `traceId` можно использовать для обращения к `/traces` (если сервер открыт).

## Ограничения
- Нет auth/ratelimiting — предполагается, что сервер находится за доверенным прокси.
- Manifest не версионируется по `ETag`; если нужна кэшируемость, добавьте свой слой поверх HTTP.
