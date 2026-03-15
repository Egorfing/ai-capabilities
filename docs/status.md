# Capability lifecycle status

`npx ai-capabilities status` provides an honest snapshot of every capability—starting from “discovered by the scanner” all the way to “wired and likely executable.” It does not replace `doctor`/`inspect`; it augments them with per-ID statuses and a project summary.

## Status definitions and reliability

| Status      | Source                          | Reliability | Meaning |
|-------------|---------------------------------|-------------|---------|
| `discovered` | Canonical manifest              | ✓ exact     | Capability exists in `output/ai-capabilities.json`. |
| `scaffolded` | `src/app-capabilities/**`       | ✓ exact     | A scaffold/auto-generated file with this `id` was found. |
| `authored`   | `defineCapability*` files       | △ heuristic | A `defineCapability`-based file exists without a `TODO` placeholder. If the tool cannot prove it, the status is `unknown`. |
| `registered` | `src/app-capabilities/registry.ts` | △ heuristic | Searches for the `id` in the default registry. Custom registries → `unknown`. |
| `wired`      | `new CapabilityRuntime` detected | △ heuristic | Global flag indicating that the project instantiates a runtime. Not evaluated per capability. |
| `executable` | Derived (`authored && registered && wired`) | △ heuristic | “Looks executable.” Not a runtime guarantee—smoke tests are still required. |

`unknown` is a valid result meaning the tool could not prove the state (e.g., nonstandard registry). It is better to return `unknown` than to guess incorrectly.

## Example notes / next steps

- `Handler TODO placeholder detected` — scaffold exists but the handler is not implemented.
- `Not found in registry.ts` — capability is missing from the default registry.
- `Add registry wiring to CapabilityRuntime` — runtime bootstrap not detected.

## How to read the report

1. Look at the summary to see how many capabilities are stuck in each phase.
2. Inspect per-capability rows and the `Notes` column to decide the next action.
3. Keep the manifest fresh for publishable capabilities—this command does not change discovery/public semantics.

## Limitations

- Custom registries or runtime wiring may not be detected, resulting in `unknown`.
- Capabilities defined outside `src/app-capabilities/**` may also end up as `unknown`.
- The automatic “executable” flag is only a signal that everything appears wired. Manual smoke tests are still mandatory before exposing a capability.
