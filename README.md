# AI Capabilities

Turn your software into an AI-compatible system.

**AI Capabilities turns any application into an agent-compatible system.**

AI Capabilities is an open standard for exposing application actions to AI agents.

Similar to how OpenAPI makes APIs machine-readable, AI Capabilities makes software controllable by AI agents.

It extracts application capabilities, builds a canonical manifest, and provides a runtime that allows AI agents to safely execute actions.

```
Application
   ↓
Capability Extraction
   ↓
Canonical Manifest
   ↓
AI Tool Adapters
   ↓
Capability Runtime
   ↓
HTTP / Well-Known Discovery
```

## Quickstart

```bash
npm install
npm run build
npm run test

npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json
npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock
npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000
npm run pilot -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json --with-enrich
```

## Why AI Capabilities

Most applications already contain actions that AI agents could use — but those actions are hidden inside APIs, UI flows, hooks, forms, and internal services.

AI Capabilities exposes those actions through a canonical manifest and runtime so agents can:

- discover available actions
- understand input/output contracts
- execute actions safely through a policy-aware runtime
- integrate with different model providers through adapters
- expose a public agent surface without leaking internal implementation details

## What AI Capabilities does

AI Capabilities provides:

- **Capability extraction** from applications (APIs, hooks, routes, forms)
- **Canonical capability manifest**
- **AI tool adapters** (OpenAI, Anthropic, internal models)
- **Capability runtime** for executing actions safely
- **Policy and safety layer**
- **Agent-compatible discovery endpoint**

## Why it exists

Modern applications contain many actions that AI agents could perform, but those actions are usually hidden inside APIs, UI flows, or internal services.

AI Capabilities exposes those actions in a structured way so agents can:

- discover them
- understand them
- safely execute them

## Comparison

OpenAPI describes APIs.

AI Capabilities describes **actions**.

## Tagline

Turn your software into an AI-compatible system.

## What you get

After running AI Capabilities on a project, you get:

- `capabilities.raw.json` — extracted technical capabilities
- `ai-capabilities.json` — canonical manifest
- `ai-capabilities.public.json` — safe public surface for external agents
- `ai-capabilities.enriched.json` — semantic metadata for agent use
- HTTP endpoints for discovery and execution
- pilot report (`pilot-report.json`, `pilot-summary.md`) with diagnostics and unsupported patterns

## Demo: fixtures/demo-app

В репозитории есть готовый demo-проект `fixtures/demo-app`, который показывает весь цикл:

1. **Извлечение** — `npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json` создаёт `output/capabilities.raw.json`.
2. **Manifest** — canonical/public версии уже сгенерированы в `fixtures/golden/demo-app/ai-capabilities*.json`.
3. **Enrichment** — повторяем `npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock`.
4. **Runtime/Server** — `npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000` поднимает HTTP API, доступное для агентов; `GET /.well-known/ai-capabilities.json` показывает публичный surface.

Этот walkthrough помогает быстро понять артефакты и адаптировать pipeline к реальному приложению.

## Основные сценарии
- **Внутренний AI copilot**: подключение к существующему проекту и предоставление LLM-помощнику списка доступных действий.
- **Model-agnostic tools**: генерация tool definitions для OpenAI, Anthropic или внутренних провайдеров из одного manifest.
- **Capability runtime**: безопасное исполнение capability через единый binding/policy слой.
- **Public agent discovery**: публикация публичных возможностей через `/.well-known/ai-capabilities.json`.
- **Pilot run**: воспроизводимый прогон на реальном приложении с отчётами и трассировкой.

## Карта документации
- [docs/quickstart.md](docs/quickstart.md) — расширенный пошаговый старт.
- [docs/demo.md](docs/demo.md) — подробный walkthrough demo-проекта.
- [docs/architecture.md](docs/architecture.md) — обзор архитектуры и поток данных.
- [docs/manifest.md](docs/manifest.md) — контракт и артефакты manifest.
- [docs/extraction.md](docs/extraction.md) — поддерживаемые extractors и pipeline.
- [docs/enrichment.md](docs/enrichment.md) — enrichment слой и модельные клиенты.
- [docs/adapters.md](docs/adapters.md) — генерация tools для разных моделей.
- [docs/runtime.md](docs/runtime.md) — runtime, binding и execution flow.
- [docs/policy.md](docs/policy.md) — safety/policy слой.
- [docs/server.md](docs/server.md) — HTTP API и режимы сервера.
- [docs/external-agents.md](docs/external-agents.md) — public discovery и well-known endpoint.
- [docs/pilot.md](docs/pilot.md) — reproducible pilot run и отчёты.
- [docs/testing.md](docs/testing.md) — стратегия тестирования и golden fixtures.
- [docs/contributing.md](docs/contributing.md) — расширение платформы.

## Package structure

Репозиторий готовится к публикации модульной экосистемы пакетов:

- `@ai-capabilities/core` — manifest/types/config utilities
- `@ai-capabilities/extract` — extraction pipeline и registry
- `@ai-capabilities/enrich` — enrichment клиенты и утилиты
- `@ai-capabilities/runtime` — capability runtime и policy binding
- `@ai-capabilities/adapters` — model tool adapters
- `@ai-capabilities/server` — HTTP транспорт и well-known endpoint
- `@ai-capabilities/cli` — CLI для команд extract/enrich/serve/pilot

Эти пакеты пока `private`, но структура готова для дальнейшей публикации по мере стабилизации API.

## Статус и ограничения MVP
- Работает на TypeScript/Node.js, целевой путь — локальные React/TS проекты.
- Extractors покрывают OpenAPI, React Query, Router и Form паттерны; остальные источники нужно добавлять вручную.
- Enrichment использует mock/internal клиентов, интеграция с LLM API пока не входит в поставку.
- Runtime рассчитан на single-tenant режим и ручное binding handlers.
- HTTP сервер предназначен для локального окружения и не включает auth/rate limiting.
- Документация описывает текущий state; breaking changes фиксируются через новые golden tests.

## License

This project is licensed under the **Apache License 2.0**.

See the [LICENSE](./LICENSE) file for details.
