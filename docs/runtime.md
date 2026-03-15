# Runtime and binding

The runtime is responsible for safely executing capabilities and binding the manifest to real handlers.

> Need help choosing between an app-local runtime, HTTP runtime, or mixed setups? See [docs/mixed-scenarios.md](./mixed-scenarios.md) for scenarios A–F, the decision matrix, and env patterns.

> **Safe discovery reminder.** The HTTP runtime serves the canonical manifest only to internal agents. To expose `/.well-known/ai-capabilities.json` you must generate `output/ai-capabilities.public.json` explicitly (e.g. `npx ai-capabilities manifest public`). If this file is missing, the well-known route stays disabled (404). The `--unsafe-public-fallback` flag exists only for dev migrations and should never be used in production.

### Manifest loader for agents/clients

When an agent simply needs the latest manifest (either local or remote), use `loadManifest`:

```ts
import { loadManifest } from "ai-capabilities";

const manifestResult = await loadManifest({
  runtimeUrl: process.env.AI_CAP_RUNTIME_URL,
  expectedVisibility: "internal",
  cacheTtlMs: 30_000,
});
```

- For `expectedVisibility: "public"` the helper automatically calls `/capabilities?visibility=public` and ensures every capability is public.
- For `expectedVisibility: "internal"` it uses `/capabilities` or falls back to the local canonical file.
- `allowFallback` lets you automatically drop back to a local file when the remote call fails.
- `ManifestLoadResult` contains `sourceKind`, `sourceDetail`, `usedFallback`, `usedCache`, and `warnings`, so clients can log what happened.

### Authored overrides vs. manifest

When a capability is authored via `defineCapability`, its schema/policy/metadata may diverge from the canonical manifest. `CapabilityRuntime` applies deterministic rules:

| Field | Runtime source of truth |
| --- | --- |
| `execute` | Always the authored capability (the handler registered in the registry). |
| `inputSchema` | If the authored definition includes a schema, it fully replaces the manifest version; otherwise the manifest schema is used. |
| `outputSchema` | Same as `inputSchema`: authored overrides manifest, otherwise use manifest. |
| `policy` | Shallow merge: start with manifest policy, then overlay authored values (visibility/risk/confirmation). |
| `metadata` | Shallow merge: manifest metadata with authored keys layered on top (nested objects are **not** merged recursively). |
| Other fields | Come from the manifest so discovery and public snapshots stay canonical. |

The runtime emits a `console.warn` explaining which fields were overridden (replace the logger if you want to capture this elsewhere). If the authored capability omits a field, the runtime continues to rely on the manifest. You still need to regenerate `output/ai-capabilities.json` for discovery, but during execution the authored DSL is the source of truth.

## Core pieces
- **`CapabilityRegistry`** (`src/runtime/capability-registry.ts`) — a map `capabilityId → handler`. Each handler is an async function that receives validated input.
- **`CapabilityRuntime`** (`src/runtime/capability-runtime.ts`) — orchestrates JSON Schema validation, policy checks, handler execution, and returns `CapabilityExecutionResult` objects.
- **`BindingResolver`** (`src/binding`) — connects capabilities to handlers (REST calls, RPC, local functions). The current MVP uses a manual registry.
- **Policy checker** — evaluates `visibility`, risk, confirmation, and permission scopes.

## Execution flow
1. An HTTP `POST /execute` (or in-process call) forms a `CapabilityExecutionRequest`:
   ```json
   {
     "capabilityId": "api.orders.list-orders",
     "input": { "limit": 5 },
     "context": {
       "mode": "internal",
       "permissionScopes": ["orders:read"],
       "allowDestructive": false,
       "confirmed": true
     }
   }
   ```
2. The runtime finds the capability in the manifest.
3. `evaluatePolicy` checks visibility, scopes, risk level, and confirmation state.
4. The JSON Schema validator checks `input` against `inputSchema`.
5. The handler runs (e.g., wraps a REST API) and returns an arbitrary object.
6. The runtime returns one of the statuses:
   - `success` + `data`
   - `pending` (confirmation required)
   - `denied` (policy) — includes `error.details.reasons`
   - `error` (handler/input failure)

Example success payload:

```json
{
  "status": "success",
  "capabilityId": "api.orders.list-orders",
  "data": { "items": [], "total": 0 },
  "durationMs": 42
}
```

## Binding strategies
- **Manual registry (default):** call `registry.register("capability.id", handler)` during runtime boot. For better DX, use `defineCapability` + `registerCapabilityDefinitions` to automatically wire handlers from declarative definitions (see [define-capability.md](./define-capability.md)).
- **HTTP binding (future):** handlers call external APIs using `execution.endpoint` from the manifest.
- **Hybrid:** register different handlers per environment if needed.

## Handler context

Any object passed through `handlerContext` becomes the second argument of every handler. This is how local agents expose router/UI adapters for frontend actions:

```ts
await runtime.execute(request, {
  handlerContext: {
    router: { navigate: (path) => appRouter.push(path) },
    ui: { openModal: (id, payload) => modals.open(id, payload) },
  },
});
```

See [frontend-actions.md](./frontend-actions.md) for adapter conventions.

## Errors and policy outcomes
- `POLICY_DENIED` — visibility mismatch, missing permission scopes, or `allowDestructive=false` while `riskLevel=high`.
- `POLICY_CONFIRMATION_REQUIRED` — `confirmationPolicy` is `once/always` but `confirmed` was not provided.
- `HANDLER_NOT_FOUND` — capability exists in the manifest but the handler is not registered.
- `INVALID_INPUT` — schema validation failed.

## Tips
- Use `CapabilityRegistry` in tests to simulate handlers (see `src/runtime/runtime.test.ts`).
- Handlers should be idempotent and return serializable data; the runtime adds traces/metrics automatically.
- If a capability is meant for public mode only, ensure its handler does not require internal tokens.
