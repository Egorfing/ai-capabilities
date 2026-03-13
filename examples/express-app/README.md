# Express middleware example

This example shows how to expose AI Capabilities over Express using the new `createAiCapabilitiesMiddleware` helper. It mounts the middleware at the root (so `/execute` and `/.well-known/ai-capabilities.json` are available immediately), registers a single safe read capability (`api.orders.list-orders`), and runs a short discovery/execution demo via the public client SDK.

## Quick start

```bash
cd examples/express-app
npm install
npm start
```

The server will:

1. Create a `CapabilityRegistry`/`CapabilityRuntime`.
2. Mount `createAiCapabilitiesMiddleware({ runtime, mode: "public" })`.
3. Run a discovery helper that calls the client SDK:

```ts
const baseUrl = "http://localhost:3000";
const manifest = await discoverCapabilities(baseUrl);
console.log(manifest.capabilities.map((cap) => cap.id));

const result = await executeCapability(baseUrl, "api.orders.list-orders", { status: "pending" });
console.log(result);
```

The sample handler returns a static list of orders so you can safely test discovery and execution flows without mutating data. Set `RUN_CLIENT_DEMO=false npm start` to skip the automatic client call.

## Endpoints exposed

- `GET /.well-known/ai-capabilities.json` – public manifest for discovery (only returns `policy.visibility === "public"` capabilities).
- `GET /capabilities` – canonical manifest (filtered to public entries when `mode: "public"` is used).
- `POST /execute` – runtime execution endpoint.

Use the `basePath` option (e.g. `/ai`) if you prefer the routes to live under a prefix.
