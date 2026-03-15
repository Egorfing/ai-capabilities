# Quickstart: from discovery to your first executable capability

This guide walks all the way from `init` to a proven runtime execution. Automatic steps (scan, extract, scaffold) only produce artifacts. A capability is **not** ready until you author the handler, verify schemas/policies, and run a smoke test.

## Overview of the phases

1. **Bootstrap** — run `init`, install deps, and confirm the config.
2. **Discover** — `inspect` / `extract` / `doctor` capture what the scanner can find.
3. **Select** — pick your first capability to wire end-to-end.
4. **Scaffold & Author** — generate a stub, then implement handler, schemas, and policy.
5. **Register & Wire** — add the capability to `registry.ts` and ensure the runtime is instantiated.
6. **Smoke-test** — execute it locally (HTTP or in-process) and confirm the result.

⚠️ **Important:** everything before phase 4 is just an inventory. No capability is executable until you finish the manual steps below.

## Phase 0 — Environment prep

```bash
npm install
npx ai-capabilities init
```

`init` creates:
- `ai-capabilities.config.json` — includes/excludes and output directories.
- `src/app-capabilities/index.ts`, `registry.ts`, and `capabilities/exampleCapability.ts`.

Without `init`, other commands do not know where to read or write manifests. When you run any CLI command in an uninitialized project, the preflight prompt will offer to run `init` automatically (TTY) or exit with a clear instruction (CI/non-interactive).

## Phase 1 — Discover (what the scanner sees)

```bash
npx ai-capabilities inspect --project .
npx ai-capabilities extract --project .
npx ai-capabilities doctor
```

You get:
- `output/capabilities.raw.json` — raw findings.
- `output/ai-capabilities.json` — canonical manifest.
- `output/ai-capabilities.public.json` — public snapshot (needed for `.well-known`).
- `doctor` report with hints about unbound capabilities.
- OpenAPI 3.x (`openapi.json|yaml`) and Swagger 2.0 (`swagger.json|yaml`) specs are supported; unsupported specs emit explicit errors.

⛔️ **Still no executable capabilities.** This is just inventory.

## Phase 2 — What’s automatic vs. manual

| Phase     | CLI handles                                 | You handle                                                        |
|-----------|---------------------------------------------|-------------------------------------------------------------------|
| Discover  | Scan OpenAPI/Swagger specs, React Query hooks, router/forms and build manifests | Decide which capabilities to implement first                      |
| Scaffold  | Generate placeholder files with `TODO execute` | Implement handlers and describe side effects                       |
| Policy/Schema | Copy whatever the scanner could infer          | Confirm data models, add `confirmationPolicy`, examples            |
| Registry/Runtime | Leave your runtime untouched                   | Register capabilities and wire them into chat/server flows         |
| Smoke-test | Does not execute anything                        | Run the capability locally and inspect logs/errors                 |

See [docs/define-capability.md](./define-capability.md) and [docs/frontend-actions.md](./frontend-actions.md) for authoring examples.

## Phase 3 — Pick the first capability

Criteria:
1. **Low risk:** start with read-only or navigation.
2. **Clear I/O:** simple schemas accelerate smoke tests.
3. **Visible outcome:** prefer something whose result is easy to observe (lists, navigation, etc.).

Use `inspect` / `doctor` to list candidates. Run `npx ai-capabilities status` to see which IDs already have scaffolds or registry entries.

## Phase 4 — Scaffold & author

1. **Generate the scaffold** (creates a `defineCapability` file):
   ```bash
   npx ai-capabilities scaffold --id api.orders.list-orders --project .
   ```
2. **Open** `src/app-capabilities/capabilities/api/orders/listOrders.ts` (path depends on the id) and:
   - Implement `execute` (reuse existing hooks/SDKs).
   - Validate `inputSchema`/`outputSchema` manually—do not rely solely on auto-generation.
   - Set `policy` (`confirmationPolicy`, dangerous actions, rate limits).
   - Refine `metadata`, `aliases`, and example intents.

> A scaffold is just a starting point. As long as `execute` contains `TODO`, the capability is only **scaffolded**, not **authored** or **executable**.

## Phase 5 — Register & wire the runtime

1. **Add the capability to `registry.ts`:**
   ```ts
   import { registerCapabilityDefinitions } from "ai-capabilities";
   import { listOrdersCapability } from "./capabilities/api/orders/listOrders";

   registerCapabilityDefinitions(runtime, [listOrdersCapability]);
   ```
2. **Ensure the runtime is created** (e.g., `new CapabilityRuntime(...)`) and receives your allowed capabilities. See `examples/react-app/src/agent/runtime.ts` or [docs/runtime.md](./runtime.md).
3. **Need an HTTP runtime?** Run `npx ai-capabilities serve --config ai-capabilities.config.json --port 4000` and pass an explicit `publicManifest` (or enable the dev-only fallback on purpose).

## Phase 6 — Smoke-test

### Option A — HTTP runtime

1. Start the server:
   ```bash
   npx ai-capabilities serve --config ai-capabilities.config.json --port 4000
   ```
2. Execute:
   ```bash
   curl -X POST http://127.0.0.1:4000/execute \
     -H "Content-Type: application/json" \
     -d '{
       "id": "api.orders.list-orders",
       "input": { "status": "open" }
     }'
   ```
3. Expect the JSON described by `outputSchema`. If the server returns an error, adjust handler/policy/schema and repeat the test.

### Option B — Direct runtime call (Node/browser)

```ts
const runtime = createCapabilityRuntime(...);
const result = await runtime.execute("api.orders.list-orders", { status: "open" });
```

Document successful runs in README/CHANGELOG so the team knows which capabilities are officially executable.

## Phase 7 — “Agent-ready” checklist

- [ ] Ran `npx ai-capabilities init`; scaffold files live in the repo.
- [ ] `inspect` / `extract` outputs are current; `output/ai-capabilities.json` is up to date.
- [ ] Picked a specific capability and generated a scaffold.
- [ ] Handler implemented; schemas/policies double-checked manually.
- [ ] Capability registered in `registry.ts` and available in the runtime.
- [ ] Local smoke test (HTTP or direct runtime) completed and recorded.
- [ ] (Optional) `output/ai-capabilities.public.json` regenerated and published via `.well-known`.

## What’s next

- Repeat the same discover → scaffold → author → register → test loop for more capabilities.
- Use [docs/mixed-scenarios.md](./mixed-scenarios.md) to select the right runtime (app-local vs. HTTP vs. browser/Node consumers).
- Run `npx ai-capabilities status` to track how many capabilities are authored/registered/wired.
- Update your project docs with the list of executable capabilities and smoke-test instructions.

Main takeaway: **auto-generation saves time, but only manual authoring + registration + testing produce a real capability**. Follow every step above to ship something agents and humans can rely on.
