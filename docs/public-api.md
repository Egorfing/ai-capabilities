# Public API surface

This package exposes a small, documented surface area that is guaranteed to be available from the root entrypoint:

```ts
import {
  defineCapability,
  registerCapabilityDefinitions,
  CapabilityRegistry,
  CapabilityRuntime,
  evaluatePolicy,
  type AiCapabilitiesManifest,
  type CapabilityHelperContext,
} from "ai-capabilities";
```

## Helper + registry exports
- `defineCapability` — DX helper for authoring manual capability definitions. Treat it as part of the authoring standard for executable actions.
- `defineCapabilityFromExtracted` — same API plus a `sourceId` that’s persisted as `metadata.extractedSourceId`. The `scaffold` and `auto-bind` CLI commands generate files that wrap this helper, so promoted hooks stay traceable.
- `registerCapabilityDefinitions` — bulk registration helper that wires `defineCapability` results into a registry.
- `capabilityDefinitionToRegistryEntry` — converts a single helper result into `{ id, handler }`.
- `CapabilityRegistry` — in-memory registry implementation used by the runtime and tests.
- `CapabilityRegistryLike` — minimal interface used by scaffolding/init templates.

## Runtime + policy exports
- `CapabilityRuntime` and `CapabilityRuntimeOptions` — policy-aware executor that validates schema + invokes handlers.
- `CapabilityRuntimeInterface`, `CapabilityRuntimeExecuteOptions`, `CapabilityHandler`, `CapabilityHandlerContext`, `ExecutionMode` — runtime contracts you can use in servers and adapters.
- `CapabilityRuntimeExecuteOptions.handlerContext` carries typed adapters (router/ui/notify) described in `CapabilityHelperContext`.
- Policy helpers: `evaluatePolicy`, `resolvePolicy`, `visibilityRule`, `permissionScopeRule`, `destructiveRule`, `confirmationRule`, `defaultPolicyRules`.

## Version
- `VERSION` — library version string (reads from `package.json` at runtime, single source of truth).

## Manifest loading
- `loadManifest(options)` — loads a capability manifest from remote URL, local file, or both with fallback. Supports caching, visibility checks, and custom fetch implementations.
- `resolveManifestSources(options)` — returns the ordered list of sources `loadManifest` will try, useful for diagnostics and debugging.
- Types: `ManifestLoaderOptions`, `ManifestLoadResult`, `ManifestSourcePlan`, `ManifestLoaderLogger`, `ManifestVisibility`.

## Types for manifests + requests
- Capability definition types: `CapabilityDefinitionInput`, `DefinedCapability`, `CapabilityExecutor`, `CapabilityPolicyDefinition`, `CapabilityHelperContext`, `CapabilityRouterAdapter`, `CapabilityUIAdapter`, `CapabilityNotifyAdapter`.
  - When starting from extracted hooks, use `ExtractedCapabilityDefinitionInput` with `defineCapabilityFromExtracted`.
- Manifest + runtime types: `AiCapabilitiesManifest`, `AiCapability`, `CapabilityExecutionRequest`, `CapabilityExecutionResult`, `PolicyDecision`, `PolicyReason`, `PolicyReasonCode`, `PolicyRule`, `CapabilityExecutionContext`, `ResolvedPolicy`, `EvaluatePolicyOptions`, `RuntimeError`, `RuntimeErrorCode`.

## Keeping exports healthy
1. All public helpers must be re-exported from `src/index.ts` (no deep-import instructions in docs/examples).
2. Run `npm run build` to refresh `dist/index.js` + `dist/index.d.ts` and check them into the repo.
3. Run `npm test` to execute the smoke tests under `src/public-api/`, which import from the published surface (runtime + types).
4. Update this file whenever you intentionally grow or trim the public API.

## Consumer checklist
- Use only the imports listed above; if you need something else, move it through the helper/runtime APIs instead of reaching into `dist/`.
- Prefer the `CapabilityRegistryLike` type when scaffolding registries outside of `CapabilityRegistry`.
- When extending the runtime or policy layer, rely on `CapabilityRuntimeInterface` instead of concrete implementations so tests can provide mocks.

## Client entrypoint — `ai-capabilities/client`

External agents and applications can import the dedicated client bundle:

```ts
import {
  getWellKnownManifest,
  discoverCapabilities,
  executeCapability,
  type ExecuteCapabilityOptions,
} from "ai-capabilities/client";
```

Exports:
- `getWellKnownManifest(baseUrl, options?)` — fetches `/.well-known/ai-capabilities.json`.
- `discoverCapabilities(baseUrl, options?)` — convenience helper that returns the manifest plus `getCapabilityById`.
- `executeCapability(baseUrl, capabilityId, input, options?)` — posts to `/execute` and returns `CapabilityExecutionResult`.
- Types: `ClientRequestOptions`, `ExecuteCapabilityOptions`, `DiscoverCapabilitiesResult`, `WellKnownManifest`, and `AiCapabilitiesClientError`.

All helpers accept optional headers/signals plus a `fetch` override, making the client portable across Node, browser, and edge runtimes. `src/client/client.public-import.test.ts` guards this surface by importing `ai-capabilities/client` from the built package.

## Server entrypoint — `ai-capabilities/server`

```ts
import {
  createServer,
  startServer,
  createAiCapabilitiesMiddleware,
  type AiCapabilitiesMiddlewareOptions,
} from "ai-capabilities/server";
```

- `createServer(deps, options?)` — low-level HTTP server used by `npx ai-capabilities serve` (exposes `/health`, `/capabilities`, `/execute`, `/traces`, `/.well-known`).
- `startServer(createServer(...))` — convenience wrapper for CLI commands.
- `createAiCapabilitiesMiddleware(options)` — Express-compatible middleware that exposes the same endpoints directly inside an existing app. Supports `runtime`, `manifest`/`manifestProvider`, optional `publicManifest`, `mode`, `basePath`, `jsonBodyLimit`, `rateLimit`, and custom loggers. Rate limiting is enabled by default (60 req/min per IP) and can be disabled with `rateLimit: false`.
- `AiCapabilitiesMiddlewareOptions`, `RateLimitConfig` — option types for the middleware helper.

Import from this entrypoint instead of deep paths so the surface stays versioned and testable.
