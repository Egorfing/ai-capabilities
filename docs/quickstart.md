# Quickstart: from discovery to your first executable capability

Эта версия quickstart показывает полный путь: от запуска `init` до момента, когда хотя бы одна capability реально исполняется через runtime. Автоматические шаги (scan, extract, scaffold) дают только заготовки. Рабочая capability появляется тогда, когда вы вручную довели handler, схему, policy и проверили исполнение.

## Обзор: обязательные фазы

1. **Bootstrap** — `init`, установка зависимостей, проверка config.
2. **Discover** — `inspect`/`extract`/`doctor` фиксируют, что умеет найти сканер.
3. **Select** — выбираем первую capability для реального подключения.
4. **Scaffold & Author** — генерируем заготовку, дописываем handler, схемы, policy.
5. **Register & Wire** — добавляем capability в `registry.ts`, подключаем runtime.
6. **Smoke-test** — локально выполняем capability и убеждаемся, что она работает.

⚠️ **Важно:** всё, что делает CLI до шага 4, — это описание возможностей приложения. До тех пор ни одна capability не считается executable. Ниже — детальный путь без пропусков.

## Фаза 0. Подготовка окружения

```bash
npm install
npx ai-capabilities init
```

`init` создаёт:
- `ai-capabilities.config.json` — пути к исходникам и output каталоги;
- `src/app-capabilities/index.ts` + `registry.ts` + `capabilities/exampleCapability.ts`.

Без `init` остальные команды не знают, откуда читать код и куда складывать manifest. Если вы запускаете `npx ai-capabilities …` в неинициализированном проекте, CLI покажет preflight и предложит выполнить `init` автоматически (в интерактивной среде) или завершится с понятным советом (в CI).

## Фаза 1. Discover: посмотреть, что видит сканер

```bash
npx ai-capabilities inspect --project .
npx ai-capabilities extract --project .
npx ai-capabilities doctor
```

Результат этой фазы:
- `output/capabilities.raw.json` — сырые находки.
- `output/ai-capabilities.json` — canonical manifest.
- `output/ai-capabilities.public.json` — public snapshot (нужен для `.well-known`).
- `doctor`-отчёт с подсказками, какие capability пока unbound.
- Поддерживаются OpenAPI 3.x (`openapi.json|yaml`) и Swagger 2.0 (`swagger.json|yaml`). Если спецификация не распознана, CLI выведет понятную ошибку.

⛔️ **На этом этапе ещё нет executable capability.** Manifest — это всего лишь инвентаризация.

## Фаза 2. Что автоматом, а что руками

| Этап | Что делает CLI автоматически | Что остаётся разработчику |
| --- | --- | --- |
| Discover | Сканирует OpenAPI/Swagger specs, React Query hooks, router/forms, строит manifest | Выбирает, какие capability реально нужны первым |
| Scaffold | Создаёт файлы-заглушки с `TODO handler` | Реализует `execute`, описывает побочные эффекты |
| Policy/Schema | Переносит, что смог вытянуть из исходников | Подтверждает структуры данных, дописывает `confirmationPolicy`, примеры |
| Registry/Runtime | Не меняет ваш runtime | Регистрирует capability и подключает runtime к чату/серверу |
| Smoke-test | Не выполняет capability | Прогоняет локальный вызов, проверяет логирование и ошибки |

Ориентируйтесь на [docs/define-capability.md](./define-capability.md) и [docs/frontend-actions.md](./frontend-actions.md) для примеров заполнения.

## Фаза 3. Выбираем первую capability

Критерии:
1. **Низкий риск.** Стартуйте с read-only или навигации.
2. **Понятный input/output.** Чем проще схема, тем быстрее smoke-test.
3. **Видимость результата.** По возможности выбирайте capability, результат которой легко увидеть (например, список заказов).

Список кандидатов видно в `inspect`/`doctor`. Дополнительно можно запустить `npx ai-capabilities status`, чтобы увидеть, что уже scaffolded/registered.

## Фаза 4. Scaffold & author

1. **Сгенерируйте scaffold** (создаёт файл с `defineCapability`):
   ```bash
   npx ai-capabilities scaffold --id api.orders.list-orders --project .
   ```
2. **Откройте файл** `src/app-capabilities/capabilities/api/orders/listOrders.ts` (путь зависит от id) и:
   - Реализуйте `execute` (используйте готовые hooks/SDK).
   - Заполните `inputSchema`/`outputSchema` — подтверждайте поля вручную, не полагайтесь на автогенерацию.
   - Настройте `policy` (`confirmationPolicy`, `dangerousCapabilities`, rate-limits).
   - Уточните `metadata`: описание, примеры user intents, UI hints.

> Scaffold — это стартовая заготовка. Пока `execute` содержит `TODO`, capability считается **scaffolded**, но не **authored** и тем более не **executable**.

## Фаза 5. Register & wire runtime

1. **Добавьте capability в `registry.ts`:**
   ```ts
   import { registerCapabilityDefinitions } from "ai-capabilities";
   import { listOrdersCapability } from "./capabilities/api/orders/listOrders";

   registerCapabilityDefinitions(runtime, [listOrdersCapability]);
   ```
2. **Убедитесь, что runtime создаётся** (например, `new CapabilityRuntime(...)`) и что в него прокинуты ваши разрешённые capability. См. `examples/react-app/src/agent/runtime.ts` или `docs/runtime.md`.
3. **Если нужен HTTP runtime**, запускайте `npx ai-capabilities serve --config ai-capabilities.config.json --port 4000` и передавайте `publicManifest` (или включайте dev-only fallback явно).

## Фаза 6. Smoke-test capability

### Вариант A. Через HTTP runtime

1. Запустите сервер:
   ```bash
   npx ai-capabilities serve --config ai-capabilities.config.json --port 4000
   ```
2. Выполните capability:
   ```bash
   curl -X POST http://127.0.0.1:4000/execute \
     -H "Content-Type: application/json" \
     -d '{
       "id": "api.orders.list-orders",
       "input": { "status": "open" }
     }'
   ```
3. Ожидаемый результат — JSON из `outputSchema`. Если сервер вернул ошибку, вернитесь к handler/policy/schema и повторите тест.

### Вариант B. Прямой runtime вызов (Node/browser)

```ts
const runtime = createCapabilityRuntime(...);
const result = await runtime.execute("api.orders.list-orders", { status: "open" });
```

Фиксируйте успешный вызов в README/CHANGELOG, чтобы вся команда знала, что capability официально executable.

## Фаза 7. Checklist «готово к агентам»

- [ ] `npx ai-capabilities init` выполнен, scaffold каталоги в репозитории.
- [ ] `inspect`/`extract` актуальны, `output/ai-capabilities.json` обновлён.
- [ ] Выбрана конкретная capability и сгенерирован scaffold.
- [ ] Handler реализован, схемы/политики проверены вручную.
- [ ] Capability зарегистрирована в `registry.ts` и доступна runtime.
- [ ] Локальный smoke-test (HTTP или прямой runtime) выполнен и зафиксирован.
- [ ] (Опционально) `output/ai-capabilities.public.json` обновлён и опубликован через `.well-known`.

## Что дальше

- Добавьте ещё capability по той же схеме: discover → scaffold → author → register → test.
- Посмотрите [docs/mixed-scenarios.md](./mixed-scenarios.md) для выбора runtime (app-local vs HTTP vs browser/Node).
- Используйте `npx ai-capabilities status`, чтобы видеть прогресс (сколько capability уже authored/registered/wired).
- Обновите документацию проекта: отдельным пунктом напишите, какие capability реально executable и как воспроизводить smoke-test.

Главная мысль quickstart теперь проста: **auto-generation экономит вам время, но только ручная доработка, регистрация и тест дают настоящую capability**. Выполните все шаги выше — и у вас будет первый рабочий инструмент, понятный как людям, так и агентам.
