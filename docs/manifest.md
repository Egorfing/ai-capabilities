# Manifest & artifacts

The manifest is the core contract between extractors, adapters, the runtime, and external agents. It is produced in several stages.

## Raw manifest — `capabilities.raw.json`
- **Source:** `npm run extract` (`runPipeline` + `mergeCapabilities`).
- **Content:** array of `RawCapability` objects (`id`, `source`, `kind`, `inputSchema`, `metadata`, diagnostic metadata).
- **Purpose:** debugging extraction. Includes original `source.filePath`, unprocessed schemas, and helper tags.
- **Allowed:** adjust raw capability structure when extractors change.
- **Forbidden:** rely on raw manifest at runtime—it may contain sensitive data.

Example (demo fixture):

```json
{
  "id": "api.orders.list-orders",
  "source": {
    "type": "openapi",
    "filePath": "fixtures/demo-app/openapi.json",
    "location": "GET /api/orders"
  },
  "kind": "read",
  "title": "List orders",
  "inputSchema": { "type": "object", "properties": { "limit": { "type": "integer" } } }
}
```

## Canonical manifest — `ai-capabilities.json`
- **Source:** `buildAiCapabilitiesManifest`.
- **Purpose:** single contract for adapters/runtime/policy.
- **Characteristics:**
  - Normalizes `displayTitle`, `description`, `policy`, `execution`, `sources`, `effects`.
  - Removes diagnostics-only data; `metadata` is internal.
  - Applies `config.policy.overrides` (visibility/risk/confirmation/permissions/tags).
- **Source of truth:** canonical manifest is what adapters and runtimes read directly.

Snippet:

```json
{
  "id": "api.orders.list-orders",
  "kind": "read",
  "displayTitle": "List orders",
  "description": "Retrieve a paginated list of orders for the current user.",
  "inputSchema": { "type": "object", "properties": { "limit": { "type": "integer" } } },
  "policy": {
    "visibility": "public",
    "riskLevel": "low",
    "confirmationPolicy": "none",
    "permissionScope": ["orders:read"]
  },
  "sources": [{ "type": "openapi" }]
}
```

## Public manifest — `ai-capabilities.public.json`
- **Source:** filter canonical manifest by `policy.visibility === "public"`, then sanitize.
- **Purpose:** public discovery surface for `.well-known` and external agents.
- **Notes:**
  - Removes `execution.handlerRef`, `metadata`, any `source.filePath`.
  - Contains public capabilities only.
  - Stays in sync with the canonical manifest (`manifestVersion`/`generatedAt`).
- **Forbidden:** add fields that reveal internal implementation details.

## Enriched manifest — `ai-capabilities.enriched.json`
- **Source:** `npm run enrich` / `runEnrichment` on top of the canonical manifest.
- **Purpose:** UX improvements (aliases, example intents, display hints).
- **Guarantees:**
  - Does not change `policy`, `inputSchema`, or `execution`.
  - May extend `displayTitle`, `userDescription`, `aliases`, `exampleIntents`.
  - If enrichment fails, the capability stays identical to the canonical manifest.

Example:

```json
{
  "id": "api.orders.list-orders",
  "displayTitle": "Handle Api Orders List Orders",
  "userDescription": "Retrieve a paginated list of orders for the current user.",
  "aliases": ["handle api orders list orders", "api.orders.list-orders"],
  "exampleIntents": ["Use api.orders.list-orders in a flow"],
  "policy": { "visibility": "public", "riskLevel": "low", "confirmationPolicy": "none" }
}
```

## Invariance rules
- Never edit the canonical manifest manually—it’s always rebuilt from raw capabilities.
- The public manifest must stay minimal and must not reference handlers/internal metadata.
- The enriched manifest is a derivative. When in doubt, regenerate canonical → enriched rather than editing enriched directly.
- All manifest versions share `manifestVersion` and `generatedAt`; golden tests will fail if structure changes without fixture updates.

## Where to find manifests
- By default (per `ai-capabilities.config.json`) they are written to `./output/` next to the config.
- The pilot runner stores artifacts in the project’s `output/` folder and records paths inside `pilot-report.json → artifacts`.
- Demo fixture golden files live in `fixtures/golden/demo-app`—use them as references when adding new fields.
