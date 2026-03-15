# Safety & Policy

The policy layer restricts capability execution based on visibility, risk, confirmation requirements, and permission scopes.

## Policy fields
Every `AiCapability` may include:
- `visibility`: `internal` or `public`. Controls whether the capability is exposed in public runtimes/manifests.
- `riskLevel`: `low | medium | high | critical` — determines whether `allowDestructive` is required.
- `confirmationPolicy`: `none | once | always` — whether user confirmation is required.
- `permissionScope`: `string[]` — arbitrary access tags (e.g., `orders:write`).

## Defaults
- Defined in `config.manifest.defaults`.
- Any missing policy fields inherit the defaults.
- `policy.overrides` in the config can tweak individual capabilities (e.g., make `api.orders.list-orders` public).

## Runtime modes
- `internal` (default): allows both internal/public capabilities, honors permission scopes and risk levels.
- `public`: only allows `visibility=public` capabilities; `allowDestructive` is always forced to `false`.
- The runtime mode flows through the HTTP server (`serve --public`) and any CLI context.

## Policy evaluation
`evaluatePolicy` returns:
- `allowed` (boolean)
- `requiresConfirmation` (boolean)
- `reasons`: array of `{ code, message }`

Example denial:
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

## Confirmation rules
- `confirmationPolicy = once`: first execution requires `confirmed=true`; subsequent calls are cached as confirmed.
- `confirmationPolicy = always`: every execution needs `confirmed=true`.
- The runtime responds with status `pending` + `POLICY_CONFIRMATION_REQUIRED` when confirmation is missing.

## MVP limitations
- No centralized audit trail for policy decisions (only traces/logs).
- Permission scopes are string tags; there is no integration with external auth providers yet.
- `allowDestructive` is passed by the caller; there’s no automatic detection of destructive handlers.
- Public mode does not support per-tenant overrides/auth.

## Best practices
- Provide `permissionScope` even for public capabilities—adapters can surface them as hints.
- Capture overrides in the config and cover them with tests (e.g., `manifest.contract.test.ts`).
- Before marking a capability as public, confirm the handler is non-destructive and safe for untrusted callers.
