# Capability lifecycle status

`npx ai-capabilities status` дает честный срез состояния каждой capability: от “просто найдена сканером” до “подключена и, скорее всего, исполнима”. Команда не заменяет `doctor/inspect`, а дополняет их, отображая статусы по ID и summary по проекту.

## Статусы и надежность

| Статус      | Источник                 | Надежность | Описание |
| ----------- | ------------------------ | ---------- | -------- |
| `discovered`| canonical manifest       | ✓ точный   | Capability присутствует в `output/ai-capabilities.json` |
| `scaffolded`| `src/app-capabilities/**` | ✓ точный   | Найден scaffold/auto файл с этим `id` |
| `authored`  | `defineCapability(*)`    | △ эвристика| На найденном файле нет TODO-placeholder, присутствует `defineCapability`. Если доказать нельзя — `unknown`. |
| `registered`| `src/app-capabilities/registry.ts` | △ эвристика | Ищем `id` в стандартном registry. Кастомные registry → `unknown`. |
| `wired`     | `new CapabilityRuntime`  | △ эвристика | Детектирует наличие runtime bootstrap в проекте. Это глобальный флаг, не per-capability. |
| `executable`| derived (`authored && registered && wired`) | △ эвристика | “Выглядит исполнимым”. Не гарантирует успешный run-time вызов. |

`unknown` — нормальный результат, означающий, что инструмент не смог доказать состояние (например, registry нестандартный). Лучше `unknown`, чем ложный `no`.

## Пример note / next step

- `Handler TODO placeholder detected` — scaffold еще не реализован.
- `Not found in registry.ts` — capability не зарегистрирована в стандартном registry.
- `Add registry wiring to CapabilityRuntime` — runtime не найден.

## Как читать отчёт

1. Смотрите summary (сколько capability “застряли” на определённом этапе).
2. Смотрите строки и колонку `Notes`, чтобы понять следующий шаг.
3. Для публикуемых capability всё равно нужно держать manifest актуальным — status команда не меняет discovery/public semantics.

## Ограничения

- Кастомные registry/runtime wiring могут не обнаружиться → `unknown`.
- Если capability определена вне `src/app-capabilities/**`, статус может быть `unknown`.
- Автоматическое определение “executable” — это просто сигнал, что всё выглядит подключённым. Фактический smoke-test по-прежнему надо делать вручную.
