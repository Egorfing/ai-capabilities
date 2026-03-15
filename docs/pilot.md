# Pilot runner

The pilot runner orchestrates extraction → manifest generation → enrichment → reporting for a real application and captures the results in one place.

## How to run

```bash
npm run pilot -- \
  --project ../real-app \
  --config ../real-app/ai-capabilities.config.json \
  --with-enrich \
  --report-dir ../real-app/output/pilot
```

Arguments:
- `--project` — target project path (overrides `config.project.root`).
- `--config` — explicit config file (otherwise resolved relative to CWD).
- `--with-enrich` — run enrichment after building the canonical manifest.
- `--report-dir` — where to store `pilot-report.json` and `pilot-summary.md` (defaults to the manifest directory).

## What happens
1. Load the config, resolve project/output paths.
2. `runCompatibilityChecks` ensures project/tsconfig/spec paths exist.
3. The extraction pipeline generates the raw manifest + diagnostics.
4. Canonical/public manifests are written according to the config.
5. (Optional) Enrichment creates `ai-capabilities.enriched.json`.
6. Diagnostics and unsupported patterns are aggregated.
7. Reports + traces are saved.

## Artifacts

The runner emits `pilot-report.json` (machine-readable) and `pilot-summary.md` (Markdown). Example summary:

```
# Pilot Summary
- **Status:** success
- **Project:** <repo>/fixtures/demo-app
- **Config:** <tmp>
- **Started:** __SNAPSHOT_TIMESTAMP__
- **Finished:** __SNAPSHOT_TIMESTAMP__
- **Trace ID:** __SNAPSHOT_ID__
...
```

Report fields include:
- `status`: `success`, `partial`, or `failed`.
- `summary.capabilitiesTotal` / `publicCapabilities`.
- `diagnostics` counts.
- `extractors[]` with per-extractor outcomes.
- `compatibility.errors` / `compatibility.warnings`.
- `artifacts` listing relative paths to manifests/traces/reports.
- `unsupportedPatterns`: normalized warning strings.

## Status meanings
- **Success** — extraction + manifest completed with no errors.
- **Partial** — manifest built but warnings/errors occurred (e.g., enrichment failed).
- **Failed** — compatibility failed or extraction crashed before producing a manifest.

## Understanding unsupported patterns
- Built from diagnostics containing `unsupported`/`not supported` keywords.
- Treat the list as a backlog for future extractor work or documentation updates.

## Tips
- Commit pilot reports into the target project repo to track pilot progress over time.
- In CI, run `npm run pilot -- --report-dir artifacts/pilot` and archive the directory (manifests + traces) as a build artifact.
- The golden regression test (`src/pilot/pilot-regression.test.ts`) keeps the demo fixture stable—only update fixtures when you intentionally change the contract.
