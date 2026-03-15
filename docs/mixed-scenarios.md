# Mixed Runtime Scenarios Guide

> Goal: за 5–10 минут выбрать нужный сценарий эксплуатации ai-capabilities, понять какой runtime нужен, где лежит manifest и как не засветить internal действия.

## Что покрывает документ

- Разница между app-local runtime, HTTP runtime и внешними потребителями.
- Где брать manifest (локальный файл, `/.well-known/ai-capabilities.json`, SDK).
- Как делить public/internal capability sets и когда включать discovery endpoint.
- Рекомендуемые env-переменные и fallback-паттерны.
- Шаги для шести типовых сценариев (A–F) и decision guide.

## Decision Matrix (TL;DR)

| Сценарий | Когда выбирать | Источник manifest | Нужен HTTP runtime | Discovery endpoint | Типичная auth-модель | Минимальные env |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Internal agent без HTTP** | Локальный Dev Agent, тесты, CLI рядом с кодом | Импортированный `src/app-capabilities/index.ts` или `output/ai-capabilities.json` | Нет | Нет | Тот же процесс, доступ к handlerContext | `AI_CAP_ENV=internal`, опционально `AI_CAP_MANIFEST_PATH` |
| **B. App-local runtime в приложении** | React/Vite UI с подключённым Copilot | Bundled manifest (statically imported) | Нет | Опционально (для telemetry) | Session пользователя (cookies) | `VITE_AI_CAP_MODE=internal`, `VITE_AI_CAP_FEATURES=runtime,ui` |
| **C. External agent via HTTP runtime** | Partner integrations, remote copilots, CI | `https://app/.well-known/ai-capabilities.json` | Да (server/service) | Да | API key / OAuth / signed JWT | `AI_CAP_RUNTIME_URL`, `AI_CAP_RUNTIME_TOKEN`, `AI_CAP_PUBLIC_MANIFEST_URL` |
| **D. Browser consumer (public)** | Extensions, внешние SPA | Public manifest по HTTP | Да (public mode) | Да | OAuth / anonymous + feature flag | `AI_CAP_PUBLIC_BASE_URL`, `AI_CAP_CLIENT_ID` |
| **E. Node/assistant consumer (server-side)** | Backend worker/assistant вызывает runtime | HTTP manifest + runtime | Да | Да | Service token / workload identity | `AI_CAP_RUNTIME_URL`, `AI_CAP_RUNTIME_TOKEN`, `AI_CAP_CACHE_TTL` |
| **F. Public vs Internal boundary** | Любой проект с mixed visibility | Canonical manifest (`output/ai-capabilities.json`) + public subset | Зависи от A–E | Public endpoint для `visibility=public` | Auth зависит от потребителя | `AI_CAP_PUBLIC_MANIFEST_URL`, `AI_CAP_INTERNAL_MANIFEST_PATH` |

## Scenario A — Internal Agent без HTTP

- **Когда**: агент живёт рядом с приложением (Vitest, Playwright, Storybook, локальный CLI).
- **Плюсы**: нулевой сетап, доступ к UI/router адаптерам, нет сетевых зависимостей.
- **Минусы**: нельзя делиться capability runtime вне процесса, нет готового discovery.
- **Call flow**: `agent -> CapabilityRuntime (mode: internal) -> handler`.
- **Manifest**: импорт `src/app-capabilities/index.ts` или чтение `output/ai-capabilities.json`.
- **Discovery endpoint**: не нужен, но можно позже подключить `npx ai-capabilities serve`.
- **Server bootstrap**: не требуется.
- **Auth assumptions**: текущий пользователь/тестовые токены уже внутри процесса.
- **Env**: `AI_CAP_MANIFEST_PATH=./output/ai-capabilities.json` (dev fallback), `AI_CAP_ENV=internal`.

## Scenario B — App-local runtime внутри React/Vite приложения

- **Когда**: Copilot/agent встроен прямо в UI (пример: `examples/react-app`).
- **Flow**:
  ```
  User action → AiChat component → CapabilityRuntime (browser) → handlers (router/ui adapters)
  ```
- **Manifest**: импортируется во время сборки (ESM) или загружается через dynamic import. Обычно хранится в `src/app-capabilities/index.ts` + registry.
- **Discovery**: необязателен; UI может показывать capabilities из локального списка.
- **Server**: не нужен, но можно ставить `npx ai-capabilities serve` для мобильного API в будущем.
- **Auth**: session cookies/headers браузера, доступ к внутренних API через existing client.
- **Env**: `VITE_AI_CAP_MODE=internal`, `VITE_AI_CAP_RUNTIME_ENABLED=true`.
- **Плюсы**: минимальная задержка, direct wiring в UI, нет CORS.
- **Минусы**: нельзя расшарить наружу, bundle size зависит от manifest.

## Scenario C — External Agent через HTTP runtime

- **Когда**: нужно обслуживать удалённого агента/партнёра, CI ассистента или серверный чат.
- **Flow**:
  ```
  External agent → HTTPS POST /execute → CapabilityRuntime(mode: public/internal) → Handlers/service layer
  ```
- **Manifest**: `/.well-known/ai-capabilities.json` (public) + `output/ai-capabilities.json` (canonical) на сервере.
- **Discovery**: обязателен (`GET /.well-known/...`), агент делает `discoverCapabilities`.
- **Server bootstrap**: `npx ai-capabilities serve --config ./ai-capabilities.config.json --port 4000` или `createAiCapabilitiesMiddleware`.
- **Auth**: API ключи, OAuth client credentials, signed JWT. Рекомендуется `AI_CAP_RUNTIME_TOKEN` + `Authorization: Bearer`.
- **Env**: `AI_CAP_RUNTIME_URL=https://app.example.com/ai-capabilities`, `AI_CAP_RUNTIME_TOKEN=...`, `AI_CAP_PUBLIC_MANIFEST_URL=https://app.example.com/.well-known/ai-capabilities.json`.
- **Плюсы**: отделение internal/public, внешний discovery, можно отслеживать usage.
- **Минусы**: требуется хостинг, TLS, rate limiting.

## Scenario D — Browser consumer discovering capabilities over HTTP

- **Когда**: внешняя SPA, extension, partner UI должен показать публичные capabilities.
- **Flow**:
  ```
  Browser app → fetch(/.well-known/ai-capabilities.json) → render catalog → POST /execute (public mode)
  ```
- **Manifest**: всегда HTTP (public subset). Локальные fallback — только в dev.
- **Discovery**: обязателен (иначе браузеру нечего показать).
- **Server**: тот же HTTP runtime, но в `mode: public`.
- **Auth**: OAuth PKCE / cookie-based session. Не публикуйте internal capabilities, подтверждайте CORS.
- **Env**: `VITE_AI_CAP_PUBLIC_BASE_URL=https://app.example.com/ai-capabilities`, `VITE_AI_CAP_PUBLIC_MANIFEST_URL=https://app.example.com/.well-known/ai-capabilities.json`.
- **Плюсы**: zero-install для потребителя, единый источник истины.
- **Минусы**: только public capabilities, нужно защищать от abuse.

## Scenario E — Node/Runtime consumer (assistant process)

- **Когда**: backend worker, cron, LLM orchestration, который вызывает runtime из Node/Python.
- **Flow**:
  ```
  Worker (Node) → discoverCapabilities(runtime URL) → executeCapability(...)
  ```
- **Manifest**: HTTP discovery, кэшировать в памяти (`AI_CAP_CACHE_TTL=300s`). Dev fallback — локальный файл.
- **Discovery**: да, чтобы worker получал актуальные policies.
- **Server**: HTTP runtime (internal mode), часто behind VPN/private network.
- **Auth**: service tokens, workload identity (GCP/Azure). Добавьте `x-agent-id` для аудит-логов.
- **Env**: `AI_CAP_RUNTIME_URL`, `AI_CAP_RUNTIME_TOKEN`, `AI_CAP_CACHE_TTL`, `AI_CAP_ENV=worker`.
- **Плюсы**: централизованный контроль, легко ревокать токены.
- **Минусы**: требуется поддерживать стабильный endpoint и версионирование manifest.

## Scenario F — Public vs Internal capability sets

- **Когда**: часть действий можно публиковать, часть — только для внутренних агентов.
- **Практика**:
  - Отмечайте `policy.visibility = "public"` только для безопасных, read-only или подтверждённых capability.
  - Internal-only действия оставляйте с visibility `internal` или `hidden`.
  - Запускайте `npx ai-capabilities extract` → canonical manifest (`output/ai-capabilities.json`), а `buildAiCapabilitiesManifest` уже формирует public subset (`output/ai-capabilities.public.json`).
  - Любая HTTP/Discovery интеграция теперь требует явный `output/ai-capabilities.public.json`. Если нужно обновить public snapshot без полного extract, запустите `npx ai-capabilities manifest public`.
- **Server**: HTTP runtime в `mode: public` отдаёт только public capabilities, `mode: internal` служит для доверенных агентов.
- **Env**: `AI_CAP_PUBLIC_MANIFEST_URL`, `AI_CAP_INTERNAL_MANIFEST_PATH`, `AI_CAP_RUNTIME_MODE`.
- **Плюсы**: легко делиться безопасной частью.
- **Риск**: случайное повышение visibility → capability уходит в well-known. Настройте review/policy.

## Decision Guide

```
Agent живёт внутри приложения?
  ├─ Да → Нужен доступ к UI/router?
  │    ├─ Да → Scenario B (app-local runtime)
  │    └─ Нет → Scenario A (internal agent без HTTP)
  └─ Нет → Агент будет браузерным потребителем?
       ├─ Да → Scenario D (browser via HTTP)
       └─ Нет → Нужен public доступ?
            ├─ Да → Scenario C (external HTTP runtime) + Scenario F для visibility
            └─ Нет → Backend worker? Scenario E (Node consumer)
```

- **Capability нельзя светить наружу** → оставляйте `visibility: "internal"`, используйте Scenario A/B/E.
- **Нужен публичный discovery** → Scenario C/D + `/.well-known/ai-capabilities.json`.
- **Быстрый dev smoke test** → Scenario A (in-process runtime) + локальный manifest.

## Recommended Environment Variables

| Var (пример) | Назначение | Сценарии |
| --- | --- | --- |
| `AI_CAP_RUNTIME_URL` | Базовый URL HTTP runtime (`https://app.com/ai-capabilities`) | C, D, E |
| `AI_CAP_RUNTIME_TOKEN` | Service/agent token | C, D (если потребитель доверенный), E |
| `AI_CAP_PUBLIC_MANIFEST_URL` | Путь к public manifest (`/.well-known/...`) | C, D, F |
| `AI_CAP_INTERNAL_MANIFEST_PATH` | Локальный canonical manifest (`./output/ai-capabilities.json`) | A, B, F |
| `AI_CAP_CACHE_TTL` | TTL кэша manifest в секундах | E |
| `AI_CAP_ENV` | `internal`, `public`, `worker` — удобно в логах | Все |
| `VITE_AI_CAP_MODE` / `NEXT_PUBLIC_AI_CAP_MODE` | Режим фронтового клиента | B, D |
| `AI_CAP_SERVER_PORT`, `AI_CAP_SERVER_HOST` | Настройка `npx ai-capabilities serve` | C |

Не обязательно использовать именно такие имена — главное, чтобы в проекте существовала чёткая схема и значения не смешивали public/internal источники.

## Manifest & Discovery Fallback Strategy

- **Читать локальный manifest** (`./output/ai-capabilities.json`) допустимо в dev/test и для Scenario A/B.
- **HTTP manifest (`/.well-known/ai-capabilities.json`)** обязателен, если потребитель вне процесса (C–E).
- **Fallback пример**:
  ```ts
  const manifestUrl = process.env.AI_CAP_PUBLIC_MANIFEST_URL ?? "http://localhost:4000/.well-known/ai-capabilities.json";
  const manifest =
    process.env.NODE_ENV === "development"
      ? await safeFetch(manifestUrl).catch(() => JSON.parse(readFileSync("./output/ai-capabilities.public.json", "utf-8")))
      : await fetch(manifestUrl).then((res) => res.json());
  ```
- **Не смешивайте**: если capability помечен internal, не выдавайте его из public fallback. Храните `output/ai-capabilities.public.json` отдельно.
- **Источник истины**: canonical manifest (`output/ai-capabilities.json`) под контролем CI; публичный — фильтрованный snapshot.
- **Dev override**: `npx ai-capabilities serve -- --unsafe-public-fallback` временно включает старый on-the-fly фильтр, но логирует предупреждение `UNSAFE`. Не используйте этот флаг в production — он существует только как migration path, пока вы не настроите автоматическую сборку public manifest.

### Manifest loader helper

Для клиентов (Node workers, внешние ассистенты, browser SDK) теперь можно использовать `loadManifest` вместо ручного выбора источника:

```ts
import { loadManifest } from "ai-capabilities";

const result = await loadManifest({
  runtimeUrl: process.env.AI_CAP_RUNTIME_URL,
  localPath: "./output/ai-capabilities.public.json",
  expectedVisibility: "public",
  allowFallback: true,
  cacheTtlMs: 60000,
});

console.log(result.sourceKind, result.sourceDetail, result.usedFallback); // diagnostics
```

- `expectedVisibility` защищает public/internal boundary.
- Helper сначала пробует remote `/capabilities` (в публичном режиме автоматически возвращает public manifest), а при ошибке (и только если `allowFallback`) переходит к локальному файлу.
- `cacheTtlMs` включает in-memory кеш для remote загрузок.
- В `result` всегда видно, откуда взят manifest (`sourceKind`, `sourceDetail`), использовался ли fallback/cache и какие предупреждения стоит показать пользователю.

## Public/Internal Boundary

- В well-known попадают только capability с `policy.visibility === "public"`.
- Internal-only действия должны оставаться в canonical manifest и runtime, который доступен через auth/внутренние каналы.
- Причины не публиковать internal capability:
  - содержит опасные side effects (`riskLevel: high`).
  - требует приватный context (router, ui adapters, секреты).
  - нарушает бизнес-политику (инвентаризация, PII).
- **Гайдлайны**:
  - Перед публикацией прогоняйте `npx ai-capabilities doctor` и проверяйте предупреждения.
  - Используйте code review + policy линтер, чтобы visibility не менялась случайно.
  - Документируйте, какие capability составляют public surface (например, чеклист в `docs/public-surface.md`).

## Implementation Checklists

- **Scenario A**
  1. `npx ai-capabilities init`
  2. Импортируйте `registerCapabilityDefinitions` в локальный agent.
  3. Храните manifest рядом (`output/ai-capabilities.json`) для тестов.
- **Scenario B**
  1. Добавьте `src/agent/runtime.ts` (см. `examples/react-app`).
  2. Передайте adapters (`router`, `ui`, `notify`) через `handlerContext`.
  3. Настройте feature flag (`VITE_AI_CAP_MODE`).
- **Scenario C**
  1. `npx ai-capabilities serve --port 4000`
  2. Настройте reverse proxy `/ai-capabilities`.
  3. Сгенерируйте public manifest: `npx ai-capabilities manifest public`.
  4. Включите auth middleware (API ключ, JWT).
  5. Опубликуйте `/.well-known/ai-capabilities.json`.
- **Scenario D**
  1. Разрешите CORS для public manifest и `/execute`.
  2. Добавьте client SDK `discoverCapabilities`.
  3. Ограничьте capabilities `visibility: "public"`.
- **Scenario E**
  1. В worker установите `ai-capabilities/client`.
  2. Читайте runtime URL/Token из env, кэшируйте manifest.
  3. Настройте retriable execution + telemetry.
- **Scenario F**
  1. Контролируйте visibility в capability files.
  2. Регулярно пересобирайте и проверяйте `output/ai-capabilities.public.json`.
  3. Документируйте boundary и audit trail.

## Known Limitations & Workarounds

- **Multi-tenant auth**: пока нет встроенного middleware — добавляйте проверку токенов/tenants до `CapabilityRuntime`.
- **Offline discovery**: браузерные потребители без сети не смогут читать manifest; используйте кэш + versioning headers.
- **Partial HTTP runtime**: смешанный режим (часть capability через HTTP, часть локально) возможно, но потребует ручного роутинга — официально поддерживаются только полностью локальный или полностью HTTP runtime.
- **Schema drift**: если локальный manifest расходится с HTTP snapshot, приоритет за canonical (CI). Следите за версиями в `output/ai-capabilities.json`.

## Дополнительные ссылки

- [docs/runtime.md](./runtime.md) — детали `CapabilityRuntime`.
- [docs/server.md](./server.md) — HTTP middleware и endpoints.
- [docs/external-agents.md](./external-agents.md) — как подключать внешних агентов.
- [examples/react-app](../examples/react-app) — пример Scenario B.
- [docs/doctor.md](./doctor.md) — как проверить состояние проекта перед публикацией.
- `npx ai-capabilities manifest public --input ./output/ai-capabilities.json --output ./output/ai-capabilities.public.json` — быстрый способ пересобрать public snapshot без повторного extract. Обязательно запускайте его в CI перед выкладкой HTTP runtime.
