# External agent integration

Use this guide when you want OpenAI, Claude, or an internal agent to call your capabilities over HTTP. The goal: treat `/.well-known/ai-capabilities.json` as a standardized discovery artifact—akin to `robots.txt`, `sitemap.xml`, or `openapi.json`—that advertises what your app can safely do.

## Surface area overview

```
Canonical manifest ──┐
                      │ filter visibility=public
                      ▼
              ai-capabilities.public.json
                      │
                      ▼
      /.well-known/ai-capabilities.json
                      │
          HTTP runtime (/execute, /capabilities)
```

- **Canonical manifest** (`output/ai-capabilities.json`) contains every capability (internal + hidden). Keep it private.
- **Public manifest** (`output/ai-capabilities.public.json`) only includes `policy.visibility === "public"`.
- **Well-known endpoint** (`/.well-known/ai-capabilities.json`) advertises discovery metadata plus the subset of public capabilities you want agents to call. External agents fetch it the same way they would `robots.txt`, but instead of crawl rules they receive structured, executable actions.
- **Runtime execution** (`POST /execute`) accepts `{ capabilityId, input }` and enforces policy (visibility, confirmation, risk).

## Publishing the well-known endpoint

1. Run `npx ai-capabilities extract` to regenerate canonical/public manifests.
2. Start the server: `npx ai-capabilities serve --config ./ai-capabilities.config.json --port 4000`.
3. Verify:
   - `GET http://localhost:4000/.well-known/ai-capabilities.json`
   - `GET http://localhost:4000/capabilities?visibility=public`
4. Behind a reverse proxy, host the same paths at your production domain (e.g., `https://app.example.com/.well-known/ai-capabilities.json`).

Think of public exposure as a contract: internal/private actions remain in the canonical manifest, while `/.well-known` is the curated, forward-compatible surface that agents can rely on. Keep destructive capabilities `internal` or `hidden` so they never leak into discovery.

### Hosting via Express
Already have an Express (or generic Node HTTP) app? Mount the runtime with the built-in middleware instead of running the standalone server:

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
    basePath: "/ai-capabilities", // optional prefix, omit for root
  }),
);

app.listen(3000);
```

The helper exposes the same trio of endpoints (`/.well-known`, `/capabilities`, `/execute`) under the optional `basePath`, supports async `manifestProvider` functions, and reuses the runtime’s policy enforcement. The example in [examples/express-app](../examples/express-app/server.ts) publishes the safe `api.orders.list-orders` capability plus a scripted discovery/execution pass using the client SDK.

### Example discovery flow
1. Agent fetches `https://app.example.com/.well-known/ai-capabilities.json`.
2. Agent reads the `capabilities` array, noting policies and input schemas (e.g., `projects.list` is `safe`, no confirmation required).
3. Agent maps each entry into its own tool/function definition.
4. When the user asks for an action that matches a public capability, the agent POSTs to `/execute` with `capabilityId` and the validated input.

## Execution endpoint

Every public capability references the same execution endpoint:

```http
POST /execute
Content-Type: application/json

{
  "capabilityId": "projects.create",
  "input": { "name": "Analytics" },
  "context": { "mode": "public" }
}
```

Response:

```json
{
  "status": "success",
  "data": { "id": "proj_123", "name": "Analytics" },
  "traceId": "trc_abc"
}
```

If a capability requires confirmation or is not public, the runtime rejects the request.

## Client SDK quickstart

Instead of wiring HTTP calls manually, install `ai-capabilities` and import the consumer helpers:

```ts
import { discoverCapabilities, executeCapability } from "ai-capabilities/client";

const { manifest, getCapabilityById } = await discoverCapabilities("https://app.example.com");
console.log("Public capabilities:", manifest.capabilities.map((cap) => cap.id));
const listOrders = getCapabilityById("api.orders.list-orders");

if (!listOrders) throw new Error("orders.list capability missing");

const result = await executeCapability(
  "https://app.example.com",
  listOrders.id,
  { limit: 10 },
);

console.log(result.status, result.data);
```

- `getWellKnownManifest(baseUrl, options?)` fetches `/.well-known/ai-capabilities.json`.
- `discoverCapabilities(baseUrl, options?)` wraps discovery plus a lookup helper.
- `executeCapability(baseUrl, capabilityId, input, options?)` POSTs to `/execute` and returns the runtime’s `CapabilityExecutionResult`, even for policy denials.

Each helper accepts headers/signals and lets you override `fetch`, so the same code works in Node, browser, or edge runtimes.

### Minimal manifest → execute example

```ts
import { getWellKnownManifest, executeCapability } from "ai-capabilities/client";

const manifest = await getWellKnownManifest("https://app.example.com");
manifest.capabilities.forEach((cap) => {
  console.log(`${cap.id} — ${cap.description}`);
});

const result = await executeCapability(
  "https://app.example.com",
  "api.orders.list-orders",
  { limit: 10 },
);
console.log(result.status, result.data);
```

## Tool-calling examples

### OpenAI (conceptual)

Provide the public manifest entry as a tool definition when creating an Assistant or Response:

```json
{
  "type": "function",
  "function": {
    "name": "projects_create",
    "description": "Creates a workspace project",
    "parameters": { "$ref": "https://yourapp.com/.well-known/ai-capabilities.json#/capabilities/projects.create/inputSchema" }
  }
}
```

When OpenAI issues a tool call, forward it directly to `POST /execute`.

### Claude (conceptual)

Anthropic’s tool syntax mirrors OpenAI’s:

```json
{
  "name": "projects_list",
  "description": "List workspace projects",
  "input_schema": { "...schema from public manifest..." }
}
```

Map the tool invocation to `/execute` and return the runtime result as the tool output.

### Custom/internal agents

1. Fetch `/.well-known/ai-capabilities.json` on startup.
2. Cache the execution endpoint + schemas.
3. For each agent plan step, POST to `/execute`.
4. Use `traceId` to correlate runtime traces or display audit logs.

## Internal vs public workflow

| Step | Internal agent | External agent |
| --- | --- | --- |
| Discovery | Canonical manifest or direct registry access | `.well-known` + `/capabilities?visibility=public` |
| Execution | In-process runtime (`runtime.execute`) | HTTP `POST /execute` |
| Policies | All levels (internal, public, hidden) | Only `visibility: "public"`; runtime enforces read-only mode |
| Context | Router/UI adapters available | None (server-side only) |

## Safety checklist

- Review `policy.visibility`, `riskLevel`, and `confirmationPolicy` per capability before marking it public.
- Maintain an allowlist of `capabilityId`s for your first pilot.
- Log all `/execute` calls with `traceId` and `capabilityId`.
- Use `npx ai-capabilities doctor --json` to confirm the project is at least `partially_executable` before exposing it externally.
- Document your rate limiting/authentication in front of the runtime. (AI Capabilities’ server assumes you run inside a trusted environment.)
