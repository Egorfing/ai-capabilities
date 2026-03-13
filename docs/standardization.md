# Standardization layers

AI Capabilities is more than a helper library—it defines a three-layer standard for exposing application actions to AI agents. Follow these layers together to ship predictable, reviewable integrations that any internal or external assistant can consume.

## 1. Discovery standard — `/.well-known/ai-capabilities.json`

- Publish a curated, read-only view of your capabilities at `/.well-known/ai-capabilities.json`, the same spirit as `robots.txt`, `sitemap.xml`, or `openapi.json`—but for executable actions.
- Produce it by filtering the canonical manifest (`output/ai-capabilities.json`) down to `visibility: "public"` (via `output/ai-capabilities.public.json`) and letting the CLI/server host it.
- External agents fetch this endpoint to learn:
  - Which capability IDs are safe to call.
  - Input/output schemas and policy metadata (risk, confirmation, visibility).
  - Which execution endpoint to hit (`POST /execute`) and any rate-limiting guidance.
- Keep destructive/internal actions out of the public manifest. Internal agents can still use the canonical manifest or runtime registry.
- Expose the contract either via `npx ai-capabilities serve` (stand-alone server) or by mounting `createAiCapabilitiesMiddleware` inside your existing Express/Node app so `/.well-known`, `/capabilities`, and `/execute` share the same origin.

References: [docs/external-agents.md](./external-agents.md), [docs/security-model.md](./security-model.md), [README.md#Discovery-standard](../README.md#discovery-standard).

## 2. Authoring standard — `defineCapability*`

- Treat `defineCapability` and `defineCapabilityFromExtracted` as the DSL for executable capabilities.
- `defineCapabilityFromExtracted` promotes discovered hooks (React Query, OpenAPI, etc.) into real handlers while keeping `sourceId` traceability.
- `defineCapability` covers bespoke UI/navigation actions or server routines written from scratch.
- Every capability file should live under `src/ai-capabilities/**`, include schemas, policy, aliases/example intents, and register via `registerCapabilityDefinitions`.
- This approach keeps authored capabilities reviewable, versionable, and easy for agents to understand.

References: [docs/define-capability.md](./define-capability.md), [docs/happy-path.md](./happy-path.md#authoring-capabilities), [README.md#Authoring-standard](../README.md#authoring-standard).

## 3. Agent-native adoption — auto-bind + AGENTS.md

- Coding assistants (Codex, Cursor, Claude Code, etc.) follow [AGENTS.md](../AGENTS.md) to diagnose a repo (`doctor`, `inspect`, `extract`, `detect-llm`), summarize findings, ask only missing questions, and generate capabilities.
- `npx ai-capabilities auto-bind` accelerates safe-read/create onboarding by generating conservative files under `src/ai-capabilities/auto/`; assistants then review and register them.
- `npx ai-capabilities scaffold --id ...` plus `defineCapabilityFromExtracted` handles the rest (mutations, UI flows, destructive operations) with explicit human review.
- Documentation such as [docs/llm-onboarding-workflow.md](./llm-onboarding-workflow.md) and [docs/agents-workflow.md](./agents-workflow.md) encode the expectation that assistants reuse existing chat/LLM stacks instead of reinventing them.

Together, these layers make AI Capabilities "the standard way to expose app actions to AI agents": discovery via `.well-known`, authoring via `defineCapability*`, and adoption via auto-bind + AGENTS-driven workflows.

## 4. Consumer/client standard — `ai-capabilities/client`

- External agents, CLI tools, or partner apps should rely on the bundled client API instead of bespoke HTTP glue.
- `getWellKnownManifest` and `discoverCapabilities` fetch the curated `.well-known` JSON and expose lookup helpers so consumers can print/log available actions.
- `executeCapability` POSTs to `/execute`, returning the runtime’s `CapabilityExecutionResult` (including policy denials), which keeps the consumer-side contract aligned with the server/runtime.
- The client accepts a `fetch` override so the same code works across Node, browsers, and edge runtimes.

Example:

```ts
import { discoverCapabilities, executeCapability } from "ai-capabilities/client";

const { capabilities } = await discoverCapabilities("https://app.example.com");
const orders = capabilities.find((cap) => cap.id === "api.orders.list-orders");
if (orders) {
  await executeCapability("https://app.example.com", orders.id, { limit: 5 });
}
```
