# Demo walkthrough

`fixtures/demo-app` is a React/TypeScript sample that covers OpenAPI (3.x), React Query, Router, and Form patterns.

Before anything else:

```bash
npx ai-capabilities init
```

This creates `ai-capabilities.config.json` and `src/app-capabilities/` (registry + example capability) which you can adapt to the demo or your own project. Definitions use `defineCapability`, so copy/pasting into real apps is straightforward (see [define-capability.md](./define-capability.md) and [frontend-actions.md](./frontend-actions.md) for UI/navigation cases).

## Quick scenario

1. **Extraction**
   ```bash
   npm run extract -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json
   ```
   - Raw capabilities → `output/capabilities.raw.json`.
   - Diagnostics → `output/diag*.log`.

2. **Manifest build**
   - Canonical/public files land in `output/ai-capabilities.json` and `output/ai-capabilities.public.json`.
   - Golden versions live in `fixtures/golden/demo-app/`.

3. **Enrichment**
   ```bash
   npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock
   ```
   - UX fields are stored alongside the canonical manifest.

4. **Runtime / Server**
   ```bash
   npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --port 4000
   ```
   - Check `GET /.well-known/ai-capabilities.json` to see public capabilities.
   - Call `POST /execute` with `capabilityId="api.orders.list-orders"`.

5. **Pilot**
   ```bash
   npm run pilot -- --project fixtures/demo-app --config fixtures/config/basic/ai-capabilities.config.json --with-enrich
   ```
   - Outputs: `pilot-report.json`, `pilot-summary.md`, traces.

6. **Doctor**
   ```bash
   npx ai-capabilities doctor
   ```
   Produces a readiness report covering config, artifacts, and next steps. See [docs/doctor.md](./doctor.md).

Want the full UI experience? Explore [examples/react-app](../examples/react-app) and [docs/happy-path.md](./happy-path.md).

## Files worth reading
- `fixtures/demo-app/openapi.json` — OpenAPI spec (Swagger 2.0 fixtures reside in `fixtures/swagger/`).
- `fixtures/demo-app/src/hooks` — React Query extractor targets.
- `fixtures/demo-app/src/router` — routes → navigation capabilities.
- `fixtures/golden/demo-app` — reference artifacts used by regression tests.
