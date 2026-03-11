# Архитектура

AI Capabilities is a capability layer that makes applications controllable by AI agents.

The platform extracts actions from applications, builds a canonical capability manifest, and exposes those capabilities through adapters and a runtime.

```
Application → Extraction → Canonical Manifest → Adapters → Runtime → Server & Discovery
```

Платформа строит полный цикл вокруг capabilities: от извлечения из исходников до публикации наружу. Ниже — линейный поток данных.

```
┌──────────┐   ┌─────────────┐   ┌──────────────┐   ┌────────────┐   ┌────────┐
│ Extract  │→ │ Normalize & │→ │ Merge / Dedup │→ │ Canonical  │→ │ Public │
│ pipeline │  │ Schema       │  │ + Diagnostics │  │ Manifest   │  │ Manifest│
└──────────┘   └─────────────┘   └──────────────┘   └────────────┘   └────────┘
      │              │                   │                  │             │
      │              │                   │                  │             ▼
      │              │                   │                  │      Enrichment
      │              │                   │                  │             │
      ▼              ▼                   ▼                  ▼             ▼
Raw capabilities → Normalized schemas → Raw manifest → ai-capabilities.json → ai-capabilities.public.json
                                                              │
                                                              ▼
                                                   Model adapters & runtime
                                                              │
                                                              ▼
                                                       HTTP server + well-known
```

## Основные слои
- **Extractors (`src/extractors`)** — читают исходники (OpenAPI, React Query, Router, Form) и формируют `RawCapability` плюс diagnostics.
- **Normalization & merge (`src/normalize`, `src/merge`)** — ограничивает глубину схем, объединяет дубли, строит `capabilities.raw.json`.
- **Manifest builder (`src/manifest`)** — превращает raw data в canonical manifest (`ai-capabilities.json`) и публичную версию (`ai-capabilities.public.json`).
- **Enrichment (`src/enrich`)** — поверх canonical manifest добавляет UX-поля (aliases, example intents и т.д.) в `ai-capabilities.enriched.json`.
- **Adapters (`src/adapters`)** — конвертируют canonical/public manifest в OpenAI/Anthropic/internal tool definitions.
- **Runtime & binding (`src/runtime`, `src/binding`)** — исполняют capability через `CapabilityRegistry`, policy слой и handlers.
- **Policy (`src/policy`)** — применяет visibility/risk/confirmation правила, завязанные на runtime mode.
- **Server & external surface (`src/server`, `src/well-known`)** — HTTP API, transport-level tracing и публичный discovery endpoint.
- **Pilot runner (`src/pilot`)** — orchestration поверх всех слоёв, формирующий отчёты и traces.

## Артефакты и source of truth
| Файл | Источник | Назначение |
| --- | --- | --- |
| `output/capabilities.raw.json` | Extract + merge | Диагностика того, что действительно найдено в коде. |
| `output/ai-capabilities.json` | Manifest builder | Canonical контракт между всеми слоями. |
| `output/ai-capabilities.public.json` | Manifest builder | Единственный источник данных для внешних агентов. |
| `output/ai-capabilities.enriched.json` | Enrichment | UX-поля, не влияющие на выполнение. |
| `fixtures/golden/demo-app/*.json` | Golden pipeline | Regression baseline для тестов. |
| `output/pilot-report.json` / `pilot-summary.md` | Pilot runner | Сжатый статус прогона приложения. |

## Extension points
- **Новые extractors** подключаются через `ExtractorRegistry` и добавляют свои diagnostics.
- **Новые adapters** реализуются в `src/adapters/model-tools` и используют `AiCapabilitiesManifest`.
- **Новые policy rules** добавляются в `src/policy/policy-checker.ts` (must be covered by tests).
- **Новые binding стратегии** описываются в `src/binding` без изменения runtime core.
- **Новые server endpoints** проходят через `create-server.ts`, но должны оставаться тонким transport слоем.

## Связь слоёв
1. CLI `extract` запускает pipeline, который пишет raw manifest и diagnostics.
2. `build-ai-capabilities` создаёт canonical/public manifest и применяет policy overrides.
3. При необходимости `enrich` дополняет canonical manifest, используя `ModelClient` (mock/internal).
4. `buildModelToolDefinitions` и специализированные adapters конвертируют capabilities для конкретных LLM API.
5. Runtime регистрирует handlers через `CapabilityRegistry`, валидацию политики обеспечивает `evaluatePolicy`.
6. HTTP server принимает запросы, валидирует payload, делегирует runtime и стримит trace events.
7. `/.well-known/ai-capabilities.json` строится из public manifest и server config, предоставляя discovery surface.
8. `pilot` склеивает все шаги, собирает traces и формирует отчёты для реального приложения.

## MVP ограничения
- Нет автоматической генерации handlers; binding остаётся ручным.
- Никакой multi-tenant aware policy, public mode = read-only.
- Не включены auth/rate limiting; предполагается локалка/внутренний VPN.
- Enrichment не изменяет schema/policy, а лишь добавляет display поля.
- Golden fixtures основаны на `fixtures/demo-app`, поэтому любые новые extractors должны иметь свои тестовые данные.
