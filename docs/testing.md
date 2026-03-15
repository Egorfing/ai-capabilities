# Testing strategy

Tests guard key contracts and golden artifacts. The suite runs on Vitest (`npm test`).

## Categories
- **Unit** — single modules (validators, extractors) with no side effects (`src/utils`, `src/extractors/*`).
- **Contract** — ensure manifest/adapters/policy stay compatible (`src/manifest/manifest.contract.test.ts`, `src/adapters/model-tools.test.ts`).
- **Integration** — end-to-end scenarios (HTTP server, pilot runner).
- **Snapshot/Golden** — compare against `fixtures/golden/demo-app/*.json` and text summaries.
- **Docs consistency** — verifies README/docs reference the current scripts (see `src/docs/docs-consistency.test.ts`).

## Golden artifacts
Located under `fixtures/golden/demo-app/` and include:
- Manifest files.
- Adapter outputs.
- Well-known response.
- Pilot report/summary.

Any contract change must update these files and their corresponding tests.

## Normalizing volatile fields
`normalizeForSnapshot` and `normalizeTextSnapshot` replace `generatedAt`, `traceId`, absolute paths, etc., with stable markers so you only update goldens when structures actually change.

## Commands

```bash
npm test
./node_modules/.bin/vitest run path/to/test.ts   # targeted run
```

## When to update goldens
1. Manifest/adapter/server contracts change.
2. New capability added to the demo fixture.
3. Pilot report structure changes.

Always confirm the changes are intentional and reflected in docs before updating goldens.

## Quick checks
- `npm run build` — TypeScript compilation.
- `npm test` — ensures docs/README links and CLI commands stay accurate (`src/docs/docs-consistency.test.ts`).
