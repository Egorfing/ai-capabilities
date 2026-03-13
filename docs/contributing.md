# Contributing guide

Thank you for helping improve AI Capabilities! This document explains how the repository is structured, which tests/docs matter, and how to make common contributions safely.

## Repository structure (high level)

| Path | Description |
| --- | --- |
| `src/` | CLI commands, extraction pipeline, manifest builder, runtime, server, doctor, and helper APIs. |
| `docs/` | Public documentation surfaced from the README. Keep this directory organized; every new concept should have a doc and a link. |
| `examples/react-app/` | Runnable demo that shows capabilities + runtime + deterministic agent. |
| `fixtures/` | Demo projects and golden outputs used by contract tests. |
| `scripts/` | Helper walkthroughs (e.g., `demo-run.md`). |

Always run `npm test` before pushing; the Vitest suite catches regressions in CLI behavior, runtime policy, and binding logic.

## General contribution rules
1. **Keep docs in sync** — update README + relevant `docs/*.md` whenever a CLI flag, file structure, or workflow changes.
2. **Prefer additive changes** — don’t remove legacy APIs without a migration guide.
3. **Maintain golden fixtures** — if extraction output changes, regenerate via `npm run pilot` and update the corresponding files in `fixtures/golden`.
4. **Respect policy defaults** — new capabilities/examples should default to `visibility: "internal"`, `riskLevel: "low"`, `confirmationPolicy: "none"`.

## Public API / export checklist
Every developer-facing helper must stay importable from the package root (`import { ... } from "ai-capabilities"`). When you introduce or update a public API:

1. **Source export** — add the symbol to `src/index.ts` (don’t rely on deep imports).
2. **Build artifacts** — run `npm run build` so `dist/index.js` and `dist/index.d.ts` include the change.
3. **Package metadata** — confirm `package.json` `exports`, `main`, and `types` resolve to the built entry.
4. **Smoke tests** — extend `src/public-api/*.test.ts` if the symbol is new so we catch regressions via `npm test`.
5. **Docs** — document the new import in `docs/public-api.md` (or the doc that mentions the helper).

If a helper shouldn’t be public, keep it undocumented and avoid exporting it from the root.

## Adding a new extractor
1. Create `src/extractors/<name>.ts` exporting an `Extractor` (see existing modules for shape).
2. Register it inside `src/extractors/index.ts` so CLI commands pick it up.
3. Add fixtures under `fixtures/` if the extractor needs sample input.
4. Write tests in `src/extractors/<name>.test.ts`. Keep them deterministic; rely on fixtures rather than network calls.
5. Update `docs/extraction.md` to describe the new source type, limitations, and configuration flags.
6. If the extractor changes manifest shape, refresh golden files via `npm run pilot`.

## Improving documentation
- Run `npm run docs-consistency` (if available) or check for broken links by building the docs site (future).
- Cross-link from README’s “Documentation map” so newcomers can discover the new page.
- Add troubleshooting entries to `docs/faq.md` whenever you fix a user-facing issue.
- For workflow walkthroughs (init → extract → doctor), update `docs/happy-path.md`, `docs/demo-scenario.md`, or `scripts/demo-run.md` as appropriate.
- Keep onboarding references in sync: `docs/llm-onboarding-workflow.md`, `docs/agents-workflow.md`, and `docs/llm-prompt.md` should always reflect the latest recommended flow and helper commands.

## Adding example capabilities or runtime wiring
1. Follow the pattern in `examples/react-app/src/ai-capabilities/capabilities/`.
2. Use `defineCapability` for net-new actions, or `defineCapabilityFromExtracted` when promoting a capability discovered via `inspect`/`extract` so `metadata.extractedSourceId` stays linked.
3. Update `examples/react-app/src/ai-capabilities/registry.ts` to register the new capability.
4. If the runtime needs new adapters (router/ui/notify), extend `examples/react-app/src/agent/runtime.ts`.
5. Document the new capability in the example README and, if it demonstrates a concept (e.g., chaining), add a dedicated doc such as `docs/capability-chaining.md`.

## Submitting documentation-only changes
1. Update the relevant `.md` files.
2. Mention the change in README if it affects onboarding.
3. No tests are required, but run `npm run lint` if you touched code snippets with TypeScript blocks to ensure formatting stays consistent.

## GitHub checklists
- When opening a **bug report**, include doctor output (`npx ai-capabilities doctor --json`) and capability samples.
- For **feature requests**, describe the DX friction and link to the doc section you want to improve.
- Every pull request should mention:
  - What changed and why.
  - Tests run (`npm test`, targeted Vitest file, or manual demo steps).
  - Docs updated (list files).

See `.github/ISSUE_TEMPLATE` and `.github/pull_request_template.md` for the exact wording that maintainers expect.
