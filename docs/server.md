# HTTP server

`npm run serve` exposes a thin transport layer on top of the runtime/policy/trace stack. The server does **not** create a runtime for you—dependencies are passed via `createServer`.

## Modes
- `internal` (default) — grants access to every capability in the canonical manifest.
- `public` (`npm run serve -- --public`) — uses the public manifest and forces the runtime into public mode.

> ⚠️ Public discovery is disabled until a public manifest is supplied. Without `output/ai-capabilities.public.json`, `/.well-known/ai-capabilities.json` returns HTTP 404. Generate the file via `npx ai-capabilities extract` or `npx ai-capabilities manifest public`. The `--unsafe-public-fallback` flag enables on-the-fly filtering but logs a warning and is not intended for production.

## Endpoints

### GET /health
```json
{
  "status": "success",
  "data": {
    "status": "ok",
    "mode": "public",
    "manifestVersion": "1.0.0",
    "app": { "name": "Fixture App" },
    "timestamp": "2026-03-11T12:34:26.260Z"
  },
  "meta": { "traceId": "..." }
}
```

### GET /capabilities
- Returns the entire manifest (canonical or public).
- Query params: `visibility`, `kind`, `capabilityId`.
- Response: `{ status: "success", data: { capabilities: [...] } }`.

### POST /execute

**Request**
```json
{
  "capabilityId": "api.orders.list-orders",
  "input": { "limit": 10 },
  "context": {
    "mode": "internal",
    "permissionScopes": ["orders:read"],
    "allowDestructive": false,
    "confirmed": true
  }
}
```

**Response (success)**
```json
{
  "status": "success",
  "data": { "ok": true },
  "meta": { "capabilityId": "api.orders.list-orders", "durationMs": 5 }
}
```

**Response (policy pending)** → HTTP 409, `status: "error"`, `error.code = "POLICY_CONFIRMATION_REQUIRED"`.

### GET /traces
- Reads trace events from `output/traces`.
- Supports queries: `traceId`, `stage`, `level`, `capabilityId`.
- Returns `{ items: [...], total }`.

### GET /.well-known/ai-capabilities.json
- Publishes the public manifest + discovery info **only when a public manifest is supplied**.
- Missing file → `404 PUBLIC_MANIFEST_MISSING`.
- Response includes `discovery.executionEndpoint`, `interaction`, and sanitized `capabilities`.

## Tracing
- Every HTTP request receives a `traceId`.
- The transport logs `http.request`, `http.response`, `http.execute.*`, etc., via `createTraceWriter`.

## Error codes

| Code | When |
| --- | --- |
| 400 | Invalid payload/schema. |
| 403 | Policy denied / private capability in public mode. |
| 404 | Capability or route not found. |
| 409 | Confirmation pending. |
| 500 | Runtime/handler error. |

## Running the server

```bash
npm run serve -- --config fixtures/config/basic/ai-capabilities.config.json --host 127.0.0.1 --port 4000
npm run serve -- --config ... --public # public mode
npm run serve -- --unsafe-public-fallback # dev only, synthesizes public manifest on the fly
```

The server does not include auth/rate limiting; it is intended for local/internal networks.

### Publishing the public manifest

`npx ai-capabilities extract` generates the public manifest automatically, but you can rebuild it on demand:

```bash
npx ai-capabilities manifest public \
  --input ./output/ai-capabilities.json \
  --output ./output/ai-capabilities.public.json
```

Add this to CI before starting the HTTP runtime to ensure discovery never serves stale data.

## Express / Node middleware

Already have an Express app and don’t want a standalone server? Use `createAiCapabilitiesMiddleware` from `ai-capabilities/server`:

```ts
import express from "express";
import { CapabilityRuntime } from "ai-capabilities";
import { createAiCapabilitiesMiddleware } from "ai-capabilities/server";

const runtime = new CapabilityRuntime({ manifest, registry, mode: "public" });
const app = express();

app.use(
  createAiCapabilitiesMiddleware({
    runtime,
    manifest,
    mode: "public",
    basePath: "/ai", // optional (defaults to root)
  }),
);

app.listen(3000);
```

The middleware exposes:
- `GET /.well-known/ai-capabilities.json` (or `/ai/.well-known/...` when `basePath` is set).
- `GET /capabilities` — canonical manifest (auto-filtered in public mode).
- `POST /execute` — delegates to `CapabilityRuntime`.

### Options

| Option | Required | Description |
| --- | --- | --- |
| `runtime` | ✅ | Instance of `CapabilityRuntime`. |
| `manifest` | ✅* | Canonical manifest. If omitted, `runtime.getManifest()` is used. |
| `manifestProvider` | ❌ | Function returning a manifest per request (alternative to `manifest`). |
| `publicManifest` | ✅** | Pre-built public manifest (required for public mode & discovery unless `allowUnsafePublicFallback` is true). |
| `mode` | ❌ | `"internal"` (default) or `"public"`. |
| `basePath` | ❌ | Route prefix (`/ai`, `/internal/tools`, etc.). |
| `jsonBodyLimit` | ❌ | Max JSON payload size (default 1 MB). |
| `allowUnsafePublicFallback` | ❌ | Dev flag: filter canonical manifest on the fly when no public manifest is supplied. Do not use in production. |

See `examples/express-app` for a runnable sample that registers a safe read capability, mounts the middleware in public mode, and demonstrates discovery → execution with the client SDK.
