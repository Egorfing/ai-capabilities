# Поэтапный план: AI Capability Extraction + Agent Runtime

Этот план рассчитан на работу в **пустой папке** и выполнение **по одному шагу за раз** с помощью Codex / Claude Code / Cursor / другого кодового агента.

## Как использовать этот план

1. Создай пустую папку проекта.
2. Положи в неё этот файл как `PLAN.md`.
3. Выполняй **один этап за раз**.
4. Для каждого этапа давай агенту только:

   * цель этапа,
   * список задач этапа,
   * критерии готовности этапа.
5. Не проси агента делать всё сразу.
6. После каждого этапа запускай проект локально и фиксируй результат.

---

# Общая цель проекта

Построить MVP-платформу, которая:

* извлекает возможности приложения из исходников,
* формирует единый `capability manifest`,
* позволяет любой LLM выбирать доступные функции,
* исполняет выбранные функции через единый runtime,
* логирует все шаги для дебага,
* в будущем может быть открыта и для внешних агентов.

---

# Целевой результат MVP

На выходе должен получиться проект, который умеет:

1. читать проект React/TypeScript,
2. извлекать хотя бы часть возможностей из:

   * OpenAPI,
   * React Query,
   * router,
   * форм или схем,
3. сохранять это в `capabilities.raw.json`,
4. обогащать это в `capabilities.enriched.json`,
5. отдавать capabilities как tools для разных моделей,
6. принимать вызов capability,
7. валидировать вход,
8. исполнять handler,
9. сохранять trace/log execution.

---

# Этап 0. Инициализация репозитория

## Цель

Подготовить базовый каркас проекта, чтобы дальше не смешивать архитектуру, парсеры, runtime и адаптеры.

## Задачи

* Инициализировать Node.js/TypeScript проект.
* Настроить `package.json`.
* Настроить `tsconfig.json`.
* Настроить базовую структуру папок.
* Настроить eslint/prettier или минимальный форматтер.
* Добавить скрипты запуска.

## Рекомендуемая структура

```text
.
├─ src/
│  ├─ core/
│  ├─ extractors/
│  ├─ enrich/
│  ├─ runtime/
│  ├─ adapters/
│  ├─ server/
│  ├─ types/
│  ├─ utils/
│  └─ cli/
├─ fixtures/
├─ output/
├─ docs/
├─ package.json
├─ tsconfig.json
└─ PLAN.md
```

## Что должен сделать агент

* создать проект на TypeScript,
* предложить минимальные зависимости,
* создать каркас директорий,
* добавить npm scripts:

  * `build`
  * `dev`
  * `lint`
  * `extract`
  * `test`

## Критерии готовности

* проект собирается без ошибок,
* есть понятная структура директорий,
* есть базовые npm scripts,
* нет лишних зависимостей.

---

# Этап 1. Описание доменной модели capability system

## Цель

Сначала зафиксировать контракт данных, а уже потом писать парсеры и runtime.

## Задачи

Создать типы для:

* `RawCapability`
* `EnrichedCapability`
* `CapabilityManifest`
* `CapabilityExecutionRequest`
* `CapabilityExecutionResult`
* `TraceEvent`
* `ModelToolDefinition`

## Что должно быть в `RawCapability`

* `id`
* `source`
* `kind`
* `title?`
* `description?`
* `inputSchema`
* `outputSchema?`
* `effects?`
* `tags?`
* `permissions?`
* `metadata`

## Что должно быть в `EnrichedCapability`

Дополнительно к raw:

* `displayTitle`
* `userDescription`
* `aliases`
* `exampleIntents`
* `confirmationPolicy`
* `riskLevel`
* `visibility`

## Что должен сделать агент

* спроектировать типы в `src/types/`
* описать минимальные enums / unions
* не переусложнять контракт
* оставить место для расширения

## Критерии готовности

* есть единый набор типов,
* типы компилируются,
* типы подходят и для внутреннего runtime, и для будущих внешних агентов.

---

# Этап 2. Формат capability manifest

## Цель

Определить единый JSON-формат, который можно:

* генерировать из проекта,
* читать LLM-агентом,
* отдавать наружу,
* логировать.

## Задачи

* Создать пример `capabilities.raw.json`.
* Создать пример `capabilities.enriched.json`.
* Описать JSON schema для manifest.
* Подготовить 3–5 примеров capabilities вручную.

## Примеры capability categories

* `read`
* `mutation`
* `navigation`
* `ui-action`
* `workflow`

## Что должен сделать агент

* создать папку `docs/contract/`
* описать JSON примеры
* описать схему полей
* сделать валидный пример manifest

## Критерии готовности

* есть понятный машиночитаемый JSON,
* manifest можно валидировать,
* по manifest уже можно строить tool definitions.

---

# Этап 3. CLI каркас

## Цель

Сделать единый CLI-вход для всех следующих этапов.

## Задачи

Создать команды:

* `extract`
* `enrich`
* `serve`
* `validate`
* `trace:list`

## Примеры команд

```bash
npm run extract -- --project ./fixtures/demo-app
npm run enrich -- --input ./output/capabilities.raw.json
npm run serve
npm run validate -- --file ./output/capabilities.enriched.json
```

## Что должен сделать агент

* выбрать библиотеку CLI или сделать простой parser args,
* сделать единую точку входа,
* добавить логирование ошибок,
* обеспечить удобный DX.

## Критерии готовности

* команды запускаются,
* есть help/usage,
* ошибки отображаются понятно.

---

# Этап 4. Базовый extractor framework

## Цель

Сделать общий каркас extractors, чтобы потом добавлять новые источники без переписывания системы.

## Задачи

Создать:

* `Extractor` interface
* `ExtractionContext`
* `ExtractionResult`
* registry extractors
* merger результатов

## Идея

Каждый extractor возвращает список `RawCapability[]` и диагностическую информацию.

## Что должен сделать агент

* создать базовые интерфейсы,
* реализовать registry,
* реализовать merge pipeline,
* предусмотреть warnings/errors.

## Критерии готовности

* можно подключить несколько extractors,
* результаты объединяются,
* сохраняется информация об источнике.

---

# Этап 5. OpenAPI extractor

## Цель

Сделать первый надёжный источник capabilities.

## Задачи

* Поддержать OpenAPI JSON/YAML.
* Извлекать:

  * method,
  * path,
  * operationId,
  * summary/description,
  * request schema,
  * response schema.
* Преобразовывать это в `RawCapability`.

## Что должен сделать агент

* реализовать parser OpenAPI,
* покрыть минимум `paths` + `requestBody` + `parameters`,
* сгенерировать capability ids,
* сохранить source metadata.

## Критерии готовности

* extractor читает demo OpenAPI,
* создаёт валидный `capabilities.raw.json`,
* для каждого endpoint есть capability.

---

# Этап 6. React Query extractor

## Цель

Находить возможности приложения по hooks и API wrappers.

## Задачи

Найти и поддержать:

* `useQuery`
* `useMutation`
* кастомные обёртки вокруг них
* query/mutation hooks в отдельных модулях

Извлекать:

* имя hook,
* тип операции,
* связанный API call,
* путь к файлу,
* примерные входные параметры.

## Что должен сделать агент

* использовать `ts-morph` или compiler API,
* сделать поиск по AST,
* поддержать минимум типовые паттерны,
* отдельно логировать unsupported patterns.

## Критерии готовности

* extractor видит типовые mutation hooks,
* создаёт raw capabilities,
* не падает на незнакомых конструкциях.

---

# Этап 7. Project config

## Цель

Добавить конфигурацию проекта, чтобы extractors могли работать с реальными кодовыми базами без хардкода.

## Задачи

Поддержать конфигурационный файл: 
ai-capabilities.config.json
или
ai-capabilities.config.ts
Конфиг должен поддерживать:

- путь к OpenAPI spec
- include/exclude patterns
- путь к tsconfig
- extractor options
- output paths
- policy overrides

## Пример

```json
{
  "project": {
    "tsconfig": "./tsconfig.json"
  },
  "extractors": {
    "openapi": {
      "spec": "./api/openapi.json"
    }
  },
  "paths": {
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
  }
}
Критерии готовности

extractor pipeline может читать config

CLI принимает --config

значения config влияют на extraction

---

# Этап 8. Diagnostics contract
## Цель

Унифицировать систему предупреждений и ошибок.

## Задачи

Создать тип:

DiagnosticEntry

Поля:

level: info | warning | error

stage: extraction | enrichment | runtime

sourceType

filePath

capabilityId?

message

details?

Diagnostics должны:

возвращаться extractors

записываться в output

выводиться CLI

Критерии готовности

extractors пишут diagnostics

CLI показывает warnings

diagnostics сериализуются в JSON

---

# Этап 9. Router extractor
## Цель

Научить систему извлекать navigation capabilities.

## Задачи

Поддержать:

React Router

route config objects

Извлекать:

path

params

component

route name

Создавать capability:

navigate.to.*
Пример capability
navigate.to.orders
navigate.to.order-details
Критерии готовности

routes появляются в manifest

capability содержит path + params

# Этап 10. Form/schema extractor
## Цель

Извлекать input parameters для пользовательских действий.

## Задачи

Поддержать:

Zod schemas

AntD Form configs

React Hook Form

Извлекать:

поля

required

enum

default values

Связывать форму с mutation/action.

Критерии готовности

inputSchema становится более точной

формы добавляют metadata к capabilities

# Этап 11. Capability identity and dedup strategy
## Цель

Объединить capabilities из разных источников.

Сейчас:

api.orders.create-order
hook.create-order

описывают одно действие.

## Задачи

Ввести понятия:

technical capability

merged capability

source references

Добавить правила приоритета:

1 OpenAPI
2 React Query
3 Forms
4 Router

Пример результата
orders.create

sources:

openapi

react-query

form

Критерии готовности

manifest не содержит дубликатов

capability может иметь несколько sources

# Этап 12. Schema normalization и $ref strategy
## Цель

Сделать inputSchema консистентной.

## Задачи

Добавить:

optional $ref resolver

canonical JSON schema

ограничение глубины schema

Поддержать библиотеку:

json-schema-ref-parser

(опционально)

Критерии готовности

adapters получают чистые schemas

manifest остаётся компактным

# Этап 13. LLM enrichment pipeline
## Цель

Добавить семантическое обогащение capabilities.

## Задачи

LLM должен генерировать:

displayTitle

userDescription

aliases

exampleIntents

riskLevel

confirmationPolicy

## Важно:

LLM не должен изобретать новые capabilities.

Критерии готовности

raw manifest превращается в enriched

enrichment можно отключить

# Этап 14. Model adapters
## Цель

Сделать систему независимой от конкретной LLM.

## Задачи

Создать adapters для:

OpenAI tools

Anthropic tool use

internal corporate LLM

mock adapter

Критерии готовности

один manifest работает с несколькими моделями

# Этап 15. Capability runtime
## Цель

Исполнять capability.

## Runtime должен

принять capabilityId

валидировать input

проверить policy

вызвать handler

вернуть result

## Критерии готовности

capability можно вызвать программно

runtime возвращает structured result

# Этап 16. Handler binding
## Цель

Связать capability с реальным исполнением.

## Поддержать режимы

manual handler

http proxy

frontend bridge

## Пример
orders.create -> POST /orders
## Критерии готовности

capabilityId имеет handler mapping

# Этап 17. Safety и policy layer
## Цель

Добавить ограничения.

## Добавить

riskLevel

confirmationPolicy

visibility

permissionScope

## Критерии готовности

destructive actions не выполняются без подтверждения

# Этап 18. Trace / logging / observability
## Цель

Сделать систему дебажимой.

## Логировать

extraction

enrichment

tool selection

execution

Trace формат:

JSONL
## Критерии готовности

можно понять цепочку действий агента

# Этап 19. HTTP server
## Цель

Открыть runtime как сервис.

## Endpoints
GET /capabilities
POST /execute
GET /health
GET /traces
## Критерии готовности

capability можно вызвать через HTTP

# Этап 20. Well-known endpoint
## Цель

Позволить внешним агентам discover capabilities.

Endpoint:

/.well-known/ai-capabilities.json

Содержит:

manifest

execution endpoint

policy hints

## Критерии готовности

внешний агент может обнаружить доступные функции

# Этап 21. Demo fixtures
## Цель

Стабильная среда для тестирования extractors.

## Добавить:

demo react app

demo openapi

demo router/forms

# Этап 22. Тесты
## Добавить

unit tests

snapshot tests manifest

runtime tests

adapter tests

# Этап 23. Документация

## Добавить:

architecture.md

manifest.md

runtime.md

external-agents.md

---

# Рекомендуемый порядок выполнения

1. Этап 0
2. Этап 1
3. Этап 2
4. Этап 3
5. Этап 4
6. Этап 5
7. Этап 9
8. Этап 10
9. Этап 11
10. Этап 12
11. Этап 14
12. Этап 15
13. Этап 16
14. Этап 17
15. Этап 18
16. Этап 19
17. Этап 6
18. Этап 7
19. Этап 8
20. Этап 20
21. Этап 21
22. Этап 22
23. Этап 23

> Почему так: сначала лучше получить работающий вертикальный срез на OpenAPI, а уже потом усложнять AST-анализом React Query, router и форм.

---

# Как формулировать задачу агенту на каждом этапе

Используй шаблон:

```md
Выполни только Этап N из PLAN.md.

Контекст:
- не трогай остальные этапы
- не добавляй лишнюю функциональность
- сделай минимально, но качественно
- если есть варианты, выбери самый простой и расширяемый

Что нужно сделать:
- [вставь задачи этапа]

Критерии готовности:
- [вставь критерии этапа]

После выполнения:
- кратко перечисли созданные файлы
- объясни архитектурные решения
- напиши, как это проверить локально
```

---

# Что важно не делать на старте

* не строить сразу полнофункциональный агентный фреймворк,
* не пытаться покрыть весь TypeScript AST мира,
* не смешивать extraction, model integration и execution в одном модуле,
* не открывать наружу destructive actions без policy,
* не завязывать архитектуру на одного LLM-провайдера.

---

# Что можно отложить на потом

* multi-step planner,
* memory layer,
* UI-виджет встроенного copilot,
* полноценный MCP server,
* auth для multi-tenant режима,
* сложный ranking capabilities по intent.

---

# Идея первого реального MVP

Если хочется быстрее дойти до результата, то минимальный practical MVP такой:

* Этап 0
* Этап 1
* Этап 2
* Этап 3
* Этап 4
* Этап 5
* Этап 9
* Этап 10
* Этап 11
* Этап 12
* Этап 14
* Этап 15

Это уже даст:

* manifest из OpenAPI,
* enrichment через LLM,
* model-independent tool contract,
* runtime execution,
* tracing,
* HTTP surface.

А React Query/router/forms можно подключать второй волной.
