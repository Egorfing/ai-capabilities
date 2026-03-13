# External agent integration

Use this guide when you want OpenAI, Claude, or an internal agent to call your capabilities over HTTP.

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
- **Well-known endpoint** (`/.well-known/ai-capabilities.json`) advertises discovery metadata plus the subset of public capabilities you want agents to call.
- **Runtime execution** (`POST /execute`) accepts `{ capabilityId, input }` and enforces policy (visibility, confirmation, risk).

## Publishing the well-known endpoint

1. Run `npx ai-capabilities extract` to regenerate canonical/public manifests.
2. Start the server: `npx ai-capabilities serve --config ./ai-capabilities.config.json --port 4000`.
3. Verify:
   - `GET http://localhost:4000/.well-known/ai-capabilities.json`
   - `GET http://localhost:4000/capabilities?visibility=public`
4. Behind a reverse proxy, host the same paths at your production domain.

Keep destructive capabilities internal/hidden so they never appear in the public manifest.

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
