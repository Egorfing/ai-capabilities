# Extraction pipeline

Extraction converts source code and specs into `RawCapability` objects.

## Supported extractors

| Extractor | Source | Key fields | Limitations |
| --- | --- | --- | --- |
| `openapi` | `openapi.json/yaml` | Methods, paths, parameters, requestBody → `inputSchema`; responses → `outputSchema` | Requires `operationId` or (tag + path) for stable IDs. |
| `react-query` | Hooks (`useQuery` / `useMutation`) | Captures query key + variables | Custom wrappers/dynamic keys show up as diagnostics. |
| `router` | Route definitions (React Router, JSX) | `kind = navigation`, `metadata.navigation.route` | Deeply nested dynamic routes are described at a high level. |
| `form` | Forms/validators | Builds `inputSchema` from the form definition | Custom validators emit warnings. |

## Config

`ai-capabilities.config.json` defines the project and extractor options:

```json
{
  "project": { "root": "../../demo-app", "tsconfig": "../../../tsconfig.json" },
  "extractors": {
    "openapi": { "spec": "../../demo-app/openapi.json" },
    "reactQuery": { "include": ["src/hooks/**"], "tsconfig": "../../../tsconfig.json" }
  }
}
```

- `paths.include/exclude` affect all extractors.
- Each extractor can declare its own include/exclude.
- All paths are resolved relative to the config file.

## Pipeline steps

1. `ExtractorRegistry` collects registered extractors (`src/extractors/index.ts`).
2. `runPipeline` executes each extractor, gathering `capabilities`, diagnostics, and `extractorsRun`.
3. `schema-normalizer` limits depth (`config.schema.maxDepth`) and marks truncated nodes.
4. `mergeCapabilities` merges entries with identical `id`s (more specific sources win).
5. Output is written to `capabilities.raw.json`; diagnostics go to `output/diag*.log`.

## Diagnostics

Diagnostics are `DiagnosticEntry` objects with `level`, `stage`, `message`, `sourceType`:
- **Info:** bookkeeping (e.g., “Processed openapi.json”).
- **Warning:** incomplete schemas, missing files, unsupported patterns.
- **Error:** extractor crashed; pipeline continues but the capability may be missing.
- `collectUnsupportedPatterns` gathers messages containing “unsupported/not supported” for pilot reports.

## Why a capability might be missing
- It was outside `paths.include` or excluded.
- The extractor ran but emitted “unsupported custom hook pattern” — inspect diagnostics.
- `policy.visibility` was overridden in `config.policy.overrides` to `internal`, so the capability is absent from the public manifest (but still in canonical).
- Schema was truncated due to `schema.maxDepth` and needs manual refinement.

## Troubleshooting tips
- Run `npm run extract -- --project <path> --config <config>` and inspect `output/capabilities.raw.json` + `output/diag*.log`.
- Enable a single extractor via `runPipeline(..., { only: ["openapi"] })` (code-level option) and add tests targeted at that case.
- Use `fixtures/golden/demo-app` as a reference—if a new capability breaks the golden files, revisit `id` and `inputSchema`.
