# Safety & Policy

Policy слой ограничивает выполнение capability в зависимости от visibility, риск-уровня и подтверждений.

## Поля policy
Каждый `AiCapability` содержит:
- `visibility`: `internal` или `public`. Управляет доступностью в public runtime и попаданием в public manifest.
- `riskLevel`: `low | medium | high | critical` — влияет на требование `allowDestructive`.
- `confirmationPolicy`: `none | once | always` — требуется ли подтверждение перед выполнением.
- `permissionScope`: `string[]` — произвольные теги доступа (например, `orders:write`).

## Defaults
- Определяются в `config.manifest.defaults`.
- Любые отсутствующие поля capability получают значения по умолчанию.
- `policy.overrides` в конфиге могут настроить конкретные capability (например, сделать `api.orders.list-orders` публичным).

## Runtime mode
- `internal` (по умолчанию): разрешены internal/public capabilities, учитываются permission scopes и risk.
- `public`: разрешены только capabilities с `visibility=public`, `allowDestructive` всегда `false`.
- Mode прокидывается через HTTP server (`serve --public`) и CLI context.

## Решение policy
`evaluatePolicy` возвращает:
- `allowed` (boolean)
- `requiresConfirmation` (boolean)
- `reasons`: массив `{ code, message }`
- Пример deny:
```json
{
  "allowed": false,
  "requiresConfirmation": false,
  "reasons": [
    { "code": "VISIBILITY_DENIED", "message": "Capability not available in public mode" },
    { "code": "MISSING_PERMISSION_SCOPE", "message": "Need scope orders:write" }
  ]
}
```

## Когда требуется confirmation
- `confirmationPolicy` = `once`: первый вызов требует подтверждения (`confirmed=true`), затем кэшируется.
- `confirmationPolicy` = `always`: подтверждение при каждом вызове.
- Runtime возвращает статус `pending` + `POLICY_CONFIRMATION_REQUIRED`.

## Ограничения MVP
- Нет централизованного audit trail для policy решений (только traces).
- Permission scopes — строковые теги, не интегрированы с внешней auth системой.
- `allowDestructive` задаётся caller-ом; автоматического определения нет.
- Public mode не поддерживает пер-tenant overrides или auth.

## Лучшие практики
- Указывайте `permissionScope` даже для public capability — adapters могут использовать их как подсказку.
- Любые overrides фиксируйте в конфиге и покрывайте тестами (`manifest.contract.test.ts`).
- Перед публикацией capability в public убедитесь, что handler не выполняет destructive действия.
