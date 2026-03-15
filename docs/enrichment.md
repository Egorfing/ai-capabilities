# Enrichment

The enrichment layer augments the canonical manifest with user-facing texts and examples so LLM agents better understand each capability.

## Why
- Add `userDescription`, `aliases`, `exampleIntents`, `displayTitle`, risk/confirmation hints when raw data is sparse.
- Leave execution-related structure untouched: `inputSchema`, `execution`, and `policy.permissionScope` stay as defined in the canonical manifest.

## Flow
1. CLI: `npm run enrich -- --input ./output/ai-capabilities.json --output ./output/ai-capabilities.enriched.json --model mock`.
2. `runEnrichment` reads the canonical manifest and iterates over capabilities.
3. For each capability, `buildEnrichmentPrompt` generates a prompt.
4. `ModelClient` (mock/internal) returns a `CapabilityEnrichment` JSON payload.
5. `applyEnrichment` merges the new fields and writes `ai-capabilities.enriched.json`.

## Model clients

| Client | Purpose | Behavior |
| --- | --- | --- |
| `mock` | Local tests | Detects `id`, builds “Handle {Name}” titles, basic intent. |
| `internal` | Rules without external APIs | Fills descriptions based on `kind`, adds risk/confirmation hints. |
| (future) external APIs | TBD | Add carefully; require separate keys + tracing. |

## Allowed vs. forbidden changes
- ✅ Add UX fields (display titles, aliases, intents, summaries).
- ✅ Record diagnostics when a client cannot process a capability.
- ❌ Modify `policy`, `inputSchema`, `execution`, or `sources`.
- ❌ Remove capabilities or change their IDs.

## Example enriched capability
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

## Diagnostics
- Any client error becomes a warning via `trace` + `DiagnosticEntry`.
- If enrichment fails, the capability is copied unchanged so downstream layers remain consistent.

## Tips
- Store the enriched manifest next to the canonical one—regenerate enrichment whenever raw data changes.
- External model clients should implement throttling and retries inside their `ModelClient` implementations.
