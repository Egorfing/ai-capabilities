# Architecture overview

AI Capabilities adds an “agent surface” to any application without rewiring your stack. The platform extracts actionable functions, describes them in a manifest, enforces policy, and exposes an execution runtime for human or AI operators.

```
┌──────────┐   ┌─────────────┐   ┌─────────────┐   ┌────────────┐   ┌──────────────┐
│  Source  │→ │  Extraction  │→ │  Manifest    │→ │  Runtime &  │→ │  Agents / LLM │
│  code    │   │  & merge     │   │  builder    │   │  registry   │   │  tool calls   │
└──────────┘   └─────────────┘   └─────────────┘   └────────────┘   └──────────────┘
      ▲               │                │                  │                    │
      │               │                │                  │                    │
      │               ▼                ▼                  ▼                    │
      │        `capabilities.raw.json` │         `ai-capabilities.json`        │
      │                                ▼                                       │
      │                         Public manifest                                │
      │                                │                                       │
      └─────────────────────────────── UI/runtime bindings ↔ Frontend actions ─┘
```

## Key components

| Layer | Responsibility | Source folders |
| --- | --- | --- |
| **Extraction** | Parse OpenAPI 3.x / Swagger 2.0 specs, React Query hooks, router definitions, or manual inputs into `RawCapability` objects (with diagnostics per source). | `src/extractors`, `src/inspect` |
| **Manifest builder** | Normalize schemas, merge duplicates, and emit canonical + public manifests. | `src/manifest`, `src/output` |
| **Enrichment** | Optional semantic metadata (display titles, aliases, intents). | `src/enrich` |
| **Registry & runtime** | Register executable handlers, evaluate policy (`visibility`, `riskLevel`, `confirmationPolicy`), and execute requests. | `src/runtime`, `src/binding`, `src/policy` |
| **Server & well-known** | HTTP transport (`/execute`, `/capabilities`, `/.well-known/ai-capabilities.json`), traces, and public discovery surface. | `src/server` |
| **Frontend actions** | Explicit navigation/UI capabilities that run inside the product shell while still using the same manifest + policy system. | `docs/frontend-actions.md`, `examples/react-app/src/app-capabilities` |

## Data flow
1. `npx ai-capabilities extract` → `output/capabilities.raw.json` + diagnostics.
2. Manifest builder writes `output/ai-capabilities.json` (canonical) and `output/ai-capabilities.public.json` (filtered to public visibility).
3. `npx ai-capabilities enrich` (optional) produces `output/ai-capabilities.enriched.json`.
4. `registerCapabilityDefinitions` loads manual definitions into a `CapabilityRegistry`.
5. Runtime executes capabilities either locally (`runtime.execute`) or via HTTP server `POST /execute`.
6. Agents/LLMs read `/.well-known/ai-capabilities.json` (the discovery standard, similar to `robots.txt` + `openapi.json` for actions) to discover public capabilities before calling `/execute`.

## Discovery surface
- `/.well-known/ai-capabilities.json` lives under your primary domain so any agent can find it using the same heuristics they use for `robots.txt`.
- Treat the canonical manifest as your internal catalog, and the well-known endpoint as the export controlled by `policy.visibility`.
- Link this surface in your docs/onboarding so partner teams know exactly where to fetch capabilities.
- See [docs/external-agents.md](./external-agents.md) and [docs/standardization.md](./standardization.md) for operational details.

## Frontend/UI flow

```
User prompt → Agent plan → Capability runtime → Handler context (router/ui/notify) → UI updates
```

Frontend actions use the same metadata as backend capabilities but their handlers call adapters like `ctx.router.navigate`. See `examples/react-app/src/agent/runtime.ts` for how to provide these adapters.

## Policy enforcement

- Every capability includes `policy.visibility`, `riskLevel`, and `confirmationPolicy`.
- The runtime refuses to run public-mode requests for internal/hidden capabilities.
- Doctor (`npx ai-capabilities doctor`) inspects manifests to ensure high-risk capabilities are gated and scaffolds exist.

## Files to know

| File | Purpose |
| --- | --- |
| `ai-capabilities.config.json` | Source of truth for extraction paths and output destinations. |
| `output/ai-capabilities.json` | Canonical manifest consumed by runtime, adapters, and agents. |
| `output/ai-capabilities.public.json` | Safe surface for external agents. |
| `examples/react-app/` | End-to-end integration demo (capabilities + runtime + chat UI). |

Use this architecture map when onboarding new contributors or explaining how AI Capabilities slots into your application stack.
