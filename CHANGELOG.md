# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-04-02

### Fixed
- Trace file paths broken on absolute paths: custom `joinPath()` in `trace-store.ts` stripped leading `/`, causing traces to be written to relative paths inside the project directory instead of the intended absolute location.
- Capability status regex double-escaped (`\\s` instead of `\s`) in `capability-status.ts`, preventing `exportName` detection and breaking lifecycle analysis.
- Removed unused imports (`readdirSync`, `join`) from `trace-writer.ts`.

### Removed
- Cleaned up `var/`, `Users/`, and `output/traces/` directories containing artifact files accidentally created by the trace path bug.
- Added `output/traces/`, `var/`, `Users/` to `.gitignore` to prevent recurrence.

## [0.4.2] - 2026-03-15

### Added
- `npx ai-capabilities status` command to summarize every capability's lifecycle (discovered, scaffolded, authored, registered, wired, executable) with honest yes/no/unknown values and next-step notes.
- `resolveManifestSources` / `loadManifest` helpers for predictable manifest source selection (runtime URLs, explicit public manifest URLs, local files) with caching.
- Preflight checks on all commands that rely on project scaffolding; interactive shells offer to run `init` immediately, CI/non-interactive mode exits with a clear message.
- Runtime logging that spells out whether public or internal manifests were loaded, from which source, and whether a fallback or cache was used.
- Reworked `docs/quickstart.md`, `docs/mixed-scenarios.md`, and README onboarding sections.
- New `docs/status.md`, `docs/runtime.md`, and manifest/public-boundary doc updates.
- JSON Server backend (`npm run dev:api`) in `examples/react-app` with React Router v6 navigation and shared chat overlay.
- `.env`/`.env.example` pairs in the example app for configuring LLM endpoints without baked-in credentials.
- Todo create/toggle through the assistant in the example app, demonstrating read and mutation capabilities end to end.

### Fixed
- Public vs. internal manifests can no longer be mixed accidentally; `.well-known/ai-capabilities.json` only serves an explicit public manifest.

## [0.4.1] - 2026-03-15

### Fixed
- Republished 0.4.0 with the top-level `README.md` bundled so npm displays the getting-started guide again. No code changes beyond version bump and repackaging.

## [0.4.0] - 2026-03-15

### Added
- Swagger 2.0 extraction: OpenAPI extractor now understands `swagger.json|yaml`, normalizes body/query parameters, and reports per-run summaries (processed/succeeded/failed).
- `npx ai-capabilities manifest public` command and `loadManifest(...)` helper for explicit public manifest handling.
- `npx ai-capabilities status` command for capability lifecycle visibility.
- Preflight/doctor diagnostics for missing init steps, absent public manifests, unsafe fallbacks, and legacy directories.
- Quickstart and docs overhaul walking teams from `init` to first executable capability.

### Changed
- New projects scaffold into `src/app-capabilities` instead of `src/ai-capabilities`.
- HTTP runtime now relies on explicit `output/ai-capabilities.public.json`.
- CLI auto-detects legacy `src/ai-capabilities`, warns once per command, and doctor flags the migration.

### Breaking
- Scaffold directory renamed from `src/ai-capabilities` to `src/app-capabilities`. Existing projects must rename the directory.
- Public manifest (`ai-capabilities.public.json`) now required for `.well-known` endpoint; implicit fallback to internal manifest removed.

## [0.3.0] - 2026-03-13

### Added
- Client SDK (`ai-capabilities/client`) with `discoverCapabilities`, `executeCapability`, and `getWellKnownManifest` helpers plus fetch injection and structured error typing.
- `createAiCapabilitiesMiddleware` Express middleware exposing `/.well-known`, `/capabilities`, and `/execute` inside existing Express/Node apps with `basePath` support.
- Zero-config quick scan: `npx ai-capabilities` chains doctor, inspect, extract, detect-llm, and auto-bind (dry run) to summarize capability readiness.
- Consumer-facing docs/examples and Express sample app demonstrating safe discovery/execution flows.

### Fixed
- Server request parsing improved to reuse Express-parsed bodies.
- Runtime error mapping tightened.

## [0.2.1] - 2026-03-13

### Fixed
- Type-safety fix in `defineCapability` (build now succeeds under `tsc` without type compatibility errors).
- Version bump across workspace packages and example app.
- Release automation docs/scripts updated.

## [0.2.0] - 2026-03-13

### Added
- Runnable example app in `examples/react-app` with its own `package.json`, Vite config, and deterministic agent.
- Capability chaining documentation for multi-step agent plans.
- External agent integration docs for publishing `/.well-known/ai-capabilities.json`, exposing `/execute`, and wiring OpenAI/Claude tool calls.
- Security model documentation consolidating visibility/risk/confirmation policies.
- CLI commands: `init`, `inspect`, `extract`, `doctor`, `serve`, `prompt`.

### Changed
- README and onboarding reorganized for faster contributor onboarding.

## [0.1.0] - 2026-03-11

### Added
- Automated capability extraction pipeline (OpenAPI, React Query, router, form hooks) producing canonical and public manifests.
- Policy-aware capability runtime with binding resolver and HTTP transport (health, capabilities, execute, traces, well-known).
- Model/tool adapters for OpenAI, Anthropic, and mock/internal providers with enrichment pipeline for semantic metadata.
- Pilot runner for compatibility validation, diagnostics, and machine-readable plus human-readable pilot reports.
- Inspect CLI for manifest summaries, filters, and JSON exports.
