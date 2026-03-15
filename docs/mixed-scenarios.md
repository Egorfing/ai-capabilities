# Mixed Runtime Scenarios Guide

> Goal: pick the right runtime setup in 5–10 minutes, understand where the manifest comes from, and avoid exposing internal capabilities by accident.

## What this guide covers

- Differences between app-local runtimes, HTTP runtimes, and external consumers.
- Manifest sources (local file, `/.well-known/ai-capabilities.json`, helper SDK).
- How to separate public/internal capability sets and when to enable the discovery endpoint.
- Recommended environment variables and fallback patterns.
- Step-by-step instructions for six common scenarios (A–F) plus a decision tree.

## Decision matrix (TL;DR)

| Scenario | When to choose it | Manifest source | HTTP runtime required? | Discovery endpoint | Typical auth | Minimum env |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Internal agent without HTTP** | Local dev agent, tests, CLI next to the code | Import `src/app-capabilities/index.ts` or read `output/ai-capabilities.json` | No | No | Same process (handlerContext access) | `AI_CAP_ENV=internal`, optional `AI_CAP_MANIFEST_PATH` |
| **B. App-local runtime inside the app** | React/Vite UI with an embedded copilot | Bundled manifest (static import) | No | Optional (telemetry) | User session (cookies) | `VITE_AI_CAP_MODE=internal`, `VITE_AI_CAP_FEATURES=runtime,ui` |
| **C. External agent via HTTP runtime** | Partner integrations, remote copilots, CI assistants | `https://app/.well-known/ai-capabilities.json` | Yes (server/service) | Yes | API key / OAuth / signed JWT | `AI_CAP_RUNTIME_URL`, `AI_CAP_RUNTIME_TOKEN`, `AI_CAP_PUBLIC_MANIFEST_URL` |
| **D. Browser consumer (public)** | Extensions or external SPA consuming public actions | Public manifest over HTTP | Yes (`mode: public`) | Yes | OAuth / anonymous + feature flag | `AI_CAP_PUBLIC_BASE_URL`, `AI_CAP_CLIENT_ID` |
| **E. Node/assistant consumer (server-side)** | Backend worker/assistant calling the runtime | HTTP manifest + runtime | Yes | Yes | Service token / workload identity | `AI_CAP_RUNTIME_URL`, `AI_CAP_RUNTIME_TOKEN`, `AI_CAP_CACHE_TTL` |
| **F. Public vs internal boundary** | Any project with mixed visibility | Canonical manifest + public subset | Depends on A–E | Public endpoint for `visibility=public` | Depends on consumer | `AI_CAP_PUBLIC_MANIFEST_URL`, `AI_CAP_INTERNAL_MANIFEST_PATH` |

## Scenario A — Internal agent (no HTTP)

- **When:** the agent runs next to the app (Vitest, Playwright, Storybook, local CLI).
- **Pros:** zero setup, direct access to UI/router adapters, no network dependencies.
- **Cons:** cannot share the runtime outside the process, no built-in discovery.
- **Flow:** `agent → CapabilityRuntime (mode: internal) → handler`.
- **Manifest:** import `src/app-capabilities/index.ts` or read `output/ai-capabilities.json`.
- **Discovery:** not needed (spin up `npx ai-capabilities serve` later if required).
- **Server:** unnecessary.
- **Auth:** current user/test token already in-process.
- **Env:** `AI_CAP_MANIFEST_PATH=./output/ai-capabilities.json` (dev fallback), `AI_CAP_ENV=internal`.

## Scenario B — App-local runtime (React/Vite)

- **When:** the copilot/agent lives inside the UI (see `examples/react-app`).
- **Flow:** `User action → AiChat component → CapabilityRuntime (browser) → handlers (router/UI adapters)`.
- **Manifest:** bundled during build (ESM import or dynamic import). Usually lives in `src/app-capabilities/index.ts` + registry.
- **Discovery:** optional—the UI can render capabilities from the local list.
- **Server:** not needed (optional `serve` later for mobile clients).
- **Auth:** browser session cookies/headers; direct access to internal APIs via existing client.
- **Env:** `VITE_AI_CAP_MODE=internal`, `VITE_AI_CAP_RUNTIME_ENABLED=true`.
- **Pros:** minimal latency, direct wiring into UI, no CORS.
- **Cons:** cannot share outside the app bundle; manifest size affects bundle size.

## Scenario C — External agent over HTTP runtime

- **When:** remote partners, CI assistants, or server-side chats rely on your runtime.
- **Flow:** `External agent → HTTPS POST /execute → CapabilityRuntime (public/internal mode) → handlers/service layer`.
- **Manifest:** use `/.well-known/ai-capabilities.json` for public discovery and keep `output/ai-capabilities.json` on the server.
- **Discovery:** required. Agents run `discoverCapabilities` against `/.well-known/...`.
- **Server bootstrap:** `npx ai-capabilities serve --config ./ai-capabilities.config.json --port 4000` or mount `createAiCapabilitiesMiddleware`.
- **Auth:** API keys, OAuth client credentials, or signed JWT. Recommended: `Authorization: Bearer <AI_CAP_RUNTIME_TOKEN>`.
- **Env:** `AI_CAP_RUNTIME_URL=https://app.example.com/ai-capabilities`, `AI_CAP_RUNTIME_TOKEN=...`, `AI_CAP_PUBLIC_MANIFEST_URL=https://app.example.com/.well-known/ai-capabilities.json`.
- **Pros:** clean separation between internal/public, built-in discovery, usage telemetry.
- **Cons:** need hosting, TLS, rate limiting, monitoring.

## Scenario D — Browser consumer (public discovery)

- **When:** an external SPA/extension needs to show public capabilities.
- **Flow:** `Browser app → fetch /.well-known/ai-capabilities.json → render catalog → POST /execute (public mode)`.
- **Manifest:** always HTTP (public subset). Local fallbacks are dev-only.
- **Discovery:** required. Without it the browser has nothing to display.
- **Server:** same HTTP runtime, but run it in `mode: public`.
- **Auth:** OAuth PKCE / session cookies. Do not expose internal capabilities; enforce CORS.
- **Env:** `VITE_AI_CAP_PUBLIC_BASE_URL=https://app.example.com/ai-capabilities`, `VITE_AI_CAP_PUBLIC_MANIFEST_URL=https://app.example.com/.well-known/ai-capabilities.json`.
- **Pros:** zero install for consumers, single source of truth.
- **Cons:** public-only surface, must defend against abuse (rate limits, quotas).

## Scenario E — Node/assistant consumer (backend worker)

- **When:** a backend worker, cron, or orchestration service calls the runtime from Node/Python.
- **Flow:** `Worker → discoverCapabilities(runtime URL) → executeCapability(...)`.
- **Manifest:** fetch over HTTP; cache in memory (`AI_CAP_CACHE_TTL=300s`). Dev fallback can read a local file.
- **Discovery:** yes—workers need fresh policies.
- **Server:** HTTP runtime in internal mode (often behind VPN/private network).
- **Auth:** service tokens or workload identity (GCP/Azure). Add `x-agent-id` headers for audit logs.
- **Env:** `AI_CAP_RUNTIME_URL`, `AI_CAP_RUNTIME_TOKEN`, `AI_CAP_CACHE_TTL`, `AI_CAP_ENV=worker`.
- **Pros:** centralized control; easy token revocation.
- **Cons:** must maintain a stable endpoint and manifest versioning.

## Scenario F — Public vs. internal capability sets

- **When:** some actions are shareable, others must stay internal.
- **Practices:**
  - Mark `policy.visibility = "public"` only for safe, read-only, or confirmed capabilities.
  - Leave internal-only actions as `visibility: "internal"` or `hidden`.
  - Run `npx ai-capabilities extract` to generate the canonical manifest (`output/ai-capabilities.json`), then build the public subset (`output/ai-capabilities.public.json`).
  - Any HTTP/discovery integration now requires an explicit public snapshot. To refresh it without a full extract, run `npx ai-capabilities manifest public`.
- **Server:** HTTP runtime in `mode: public` serves only public capabilities; `mode: internal` is used for trusted agents.
- **Env:** `AI_CAP_PUBLIC_MANIFEST_URL`, `AI_CAP_INTERNAL_MANIFEST_PATH`, `AI_CAP_RUNTIME_MODE`.
- **Pros:** easy to share the safe subset.
- **Risk:** accidental visibility changes push actions to well-known. Enforce review/policy checks.

## Decision guide

```
Agent lives inside the app?
  ├─ Yes → Needs UI/router access?
  │    ├─ Yes → Scenario B (app-local runtime)
  │    └─ No  → Scenario A (internal agent without HTTP)
  └─ No → Will the agent run in the browser?
       ├─ Yes → Scenario D (browser via HTTP)
       └─ No  → Need public discovery?
            ├─ Yes → Scenario C (external HTTP runtime) + Scenario F for visibility
            └─ No  → Backend worker? Scenario E (Node consumer)
```

- **Capability must stay private?** Keep `visibility: "internal"` and stick to scenarios A/B/E.
- **Need public discovery?** Choose scenarios C/D and publish `/.well-known/ai-capabilities.json`.
- **Need a quick dev smoke test?** Scenario A with the local manifest.

## Recommended environment variables

| Variable | Purpose | Scenarios |
| --- | --- | --- |
| `AI_CAP_RUNTIME_URL` | Base URL of the HTTP runtime (`https://app.com/ai-capabilities`) | C, D, E |
| `AI_CAP_RUNTIME_TOKEN` | Service/agent token | C, D (trusted consumers), E |
| `AI_CAP_PUBLIC_MANIFEST_URL` | Public manifest URL (`/.well-known/...`) | C, D, F |
| `AI_CAP_INTERNAL_MANIFEST_PATH` | Local canonical manifest (`./output/ai-capabilities.json`) | A, B, F |
| `AI_CAP_CACHE_TTL` | Manifest cache TTL (seconds) | E |
| `AI_CAP_ENV` | `internal`, `public`, `worker` (useful in logs) | All |
| `VITE_AI_CAP_MODE` / `NEXT_PUBLIC_AI_CAP_MODE` | Front-end runtime mode | B, D |
| `AI_CAP_SERVER_PORT`, `AI_CAP_SERVER_HOST` | Settings for `npx ai-capabilities serve` | C |

You don’t need these exact names—reuse whatever scheme your project already follows; just keep public/internal sources separated.

## Manifest & discovery fallback strategy

- **Local manifest (`./output/ai-capabilities.json`)** is fine for dev/test and scenarios A/B.
- **HTTP manifest (`/.well-known/ai-capabilities.json`)** is required whenever the consumer is out-of-process (scenarios C–E).
- **Fallback example:**
  ```ts
  const manifestUrl = process.env.AI_CAP_PUBLIC_MANIFEST_URL ?? "http://localhost:4000/.well-known/ai-capabilities.json";
  const manifest =
    process.env.NODE_ENV === "development"
      ? await safeFetch(manifestUrl).catch(() => JSON.parse(readFileSync("./output/ai-capabilities.public.json", "utf-8")))
      : await fetch(manifestUrl).then((res) => res.json());
  ```
- **Don’t mix contexts:** if a capability is marked `internal`, never expose it via a public fallback. Keep `output/ai-capabilities.public.json` separate.
- **Source of truth:** canonical manifest (CI-controlled) → public snapshot is a filtered copy.
- **Dev override:** `npx ai-capabilities serve -- --unsafe-public-fallback` temporarily re-enables on-the-fly filtering but logs `UNSAFE`. Only for migration—never in production.

### Manifest loader helper recap

```ts
import { loadManifest } from "ai-capabilities";

const result = await loadManifest({
  runtimeUrl: process.env.AI_CAP_RUNTIME_URL,
  localPath: "./output/ai-capabilities.public.json",
  expectedVisibility: "public",
  allowFallback: true,
  cacheTtlMs: 60_000,
});

console.log(result.sourceKind, result.sourceDetail, result.usedFallback);
```

- `expectedVisibility` enforces the boundary.
- The helper tries remote `/capabilities` first (public mode automatically returns the public manifest) and falls back to the local file only when allowed.
- `cacheTtlMs` enables in-memory caching for remote loads.
- The result always reports the source, whether fallback/cache was used, and any warnings to show the operator.

## Public/internal boundary tips

- Only capabilities with `policy.visibility === "public"` appear in well-known.
- Internal-only actions live exclusively in the canonical manifest and internal runtime.
- Reasons to keep actions internal: destructive side effects, private context (router/UI adapters, secrets), or policy constraints (PII, compliance).
- Checklist before publishing:
  - Run `npx ai-capabilities doctor` and review warnings.
  - Use code review/policy linters to avoid accidental visibility changes.
  - Document which capabilities form the public surface (e.g., `docs/public-surface.md`).

## Implementation checklists

- **Scenario A**
  1. `npx ai-capabilities init`.
  2. Import `registerCapabilityDefinitions` in the local agent.
  3. Keep `output/ai-capabilities.json` nearby for tests.
- **Scenario B**
  1. Add `src/agent/runtime.ts` (see `examples/react-app`).
  2. Pass adapters (`router`, `ui`, `notify`) via `handlerContext`.
  3. Configure a feature flag (`VITE_AI_CAP_MODE`).
- **Scenario C**
  1. `npx ai-capabilities serve --port 4000`.
  2. Configure a reverse proxy for `/ai-capabilities`.
  3. Generate the public manifest: `npx ai-capabilities manifest public`.
  4. Enable auth middleware (API key, JWT, etc.).
  5. Publish `/.well-known/ai-capabilities.json`.
- **Scenario D**
  1. Allow CORS for the public manifest and `/execute`.
  2. Use the client SDK (`discoverCapabilities`).
  3. Restrict the manifest to `visibility: "public"` capabilities only.
- **Scenario E**
  1. Install `ai-capabilities/client` in the worker.
  2. Read runtime URL/token from env and cache the manifest.
  3. Implement retriable execution + telemetry.
- **Scenario F**
  1. Control visibility in capability files.
  2. Rebuild and verify `output/ai-capabilities.public.json` regularly.
  3. Document the boundary and audit trail.

## Known limitations & workarounds

- **Multi-tenant auth:** no built-in middleware yet—validate tenant tokens before invoking `CapabilityRuntime`.
- **Offline discovery:** browser consumers without network access cannot fetch manifests; rely on caches + version headers.
- **Partial HTTP runtime:** mixing HTTP/local runtimes requires custom routing. Official support covers fully local or fully HTTP setups.
- **Schema drift:** if the local manifest diverges from the HTTP snapshot, canonical (CI-built) artifacts win. Track versions in `output/ai-capabilities.json`.

## Additional links

- [docs/runtime.md](./runtime.md) — runtime internals.
- [docs/server.md](./server.md) — HTTP middleware and endpoints.
- [docs/external-agents.md](./external-agents.md) — how to onboard external agents.
- [examples/react-app](../examples/react-app) — reference for Scenario B.
- [docs/doctor.md](./doctor.md) — readiness checklist before publishing.
- `npx ai-capabilities manifest public --input ./output/ai-capabilities.json --output ./output/ai-capabilities.public.json` — quick way to rebuild the public snapshot without re-running extract (add it to CI before deploying an HTTP runtime).
