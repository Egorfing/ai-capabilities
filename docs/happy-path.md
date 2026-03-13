# Happy-path integration guide

This guide walks through the minimal steps to go from zero to an AI-powered UI using AI Capabilities. Follow along with `examples/react-app` or your own project. Keep [README.md](../README.md) nearby for the CLI map and use [docs/llm-onboarding-workflow.md](./llm-onboarding-workflow.md) if a coding assistant is driving.

## 1. Install dependencies
```bash
npm install ai-capabilities
```
Optionally add React/TypeScript if you are building a frontend scaffold.

## 2. Initialize the project
```bash
npx ai-capabilities init
```
This creates `ai-capabilities.config.json` and the `src/ai-capabilities/` scaffold.

## 3. Define capabilities (authoring standard)
Add files under `src/ai-capabilities/capabilities/` using the helper DSL:
- `defineCapabilityFromExtracted` when you promote an extracted hook; it preserves `sourceId` and keeps the manifest traceable.
- `defineCapability` when you author frontend/navigation or bespoke server actions from scratch.

This is the canonical authoring model: manifests describe discovery, helper files describe executable intent. Start with:
- A backend mutation (e.g., `projects.create`)
- A safe read capability (`projects.list`)
- A UI/navigation action (`navigation.open-project-page`)

Refer to `examples/react-app/src/ai-capabilities/capabilities/*.ts` for copy-paste starting points.

As soon as each file exists, assign conservative policy metadata (visibility/risk/confirmation). The [security model](./security-model.md) recommends `visibility: "internal"`, `riskLevel: "low"`, `confirmationPolicy: "none"` for reads and `riskLevel: "medium"`, `confirmationPolicy: "once"` for writes during pilots.

### Generate scaffolds automatically
List extracted capability IDs at any time without generating files:
```bash
npx ai-capabilities scaffold --list
```

In interactive terminals you can even skip `--id` entirely; the CLI shows a numbered picker and scaffolds the selection. CI/non-interactive shells continue to print the list and exit to avoid hanging.

Instead of creating files manually, run:
```bash
npx ai-capabilities scaffold --id hook.create-project-mutation \
  --manifest ./output/ai-capabilities.json \
  --dir ./src/ai-capabilities/capabilities
```
The command copies metadata from the canonical manifest, creates `createProjectCapability.ts`, and wires `defineCapabilityFromExtracted` with `sourceId` already set. Edit the generated file to pick the final `id` and implement `execute`.

### Auto-bind safe reads and creates
To bootstrap the obvious read/create capabilities in bulk:
```bash
npx ai-capabilities auto-bind \
  --manifest ./output/ai-capabilities.json \
  --dir ./src/ai-capabilities/auto
```
Run with `--dry-run` first to preview what would happen. The CLI writes conservative `defineCapabilityFromExtracted` files into `src/ai-capabilities/auto/` (safe read/list queries plus create/update mutations). Review them, move anything that needs customization into `capabilities/`, then register the exports in your registry.

Use this split to stay safe:
- **auto-bind** → obvious, low-risk reads/creates you want quickly (agent-native fast path).
- **scaffold/hand-authored** → higher-risk mutations, destructive flows, UI/navigation behavior that needs human judgment.

## 4. Register capabilities and wire the runtime
Inside `src/ai-capabilities/registry.ts`:
```ts
import { registerCapabilityDefinitions } from "ai-capabilities";
import { createProjectCapability } from "./capabilities/createProject";

export const capabilities = [createProjectCapability /* ... */];
export function registerCapabilities(registry: CapabilityRegistry) {
  registerCapabilityDefinitions(registry, capabilities);
}
```
Create a runtime helper (see `examples/react-app/src/agent/runtime.ts`) that:
- Builds a manifest from the same capability definitions
- Instantiates `CapabilityRuntime`
- Passes router/ui/notify adapters through `handlerContext`

### Example: promoting an extracted capability
```ts
import { defineCapabilityFromExtracted } from "ai-capabilities";

export const projectsCreateCapability = defineCapabilityFromExtracted({
  sourceId: "hook.create-project-mutation",
  id: "projects.create",
  displayTitle: "Create project",
  description: "Creates a workspace project",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" }
    },
    required: ["name"]
  },
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once"
  },
  async execute({ name, description }) {
    return projectApi.create({ name, description });
  }
});
```

## 5. Run extraction + doctor + inspect
```bash
npx ai-capabilities extract
npx ai-capabilities doctor
npx ai-capabilities inspect --json | jq
```
- `extract` generates raw/canonical/public manifests.
- `doctor` diagnoses readiness and lists next steps.
- `inspect` inventories capabilities by kind/visibility/executability.

Running `extract` will create or refresh the `output/` directory. Everything inside (`ai-capabilities*.json`, diagnostics, traces) is generated from your source code—treat it like build output. `output/` is fully regenerable: delete it and run `npx ai-capabilities extract` whenever you need a fresh manifest. Keep authoring executable capabilities in `src/ai-capabilities`, using the manifest data as input for `defineCapabilityFromExtracted`. Before asking more questions, run `npx ai-capabilities detect-llm --project .` (or `--json`) to see whether an AI/LLM stack already exists. Coding assistants should follow [docs/llm-onboarding-workflow.md](./llm-onboarding-workflow.md) if they need a guided inspect → question → generate loop.

Address any issues before continuing (missing enriched manifest, unbound capabilities, etc.).

## 6. Optional: use LLM prompts to enrich metadata
If display titles, schemas, or policies feel incomplete, run:
```bash
npx ai-capabilities prompt --template backend --file ./output/ai-capabilities.json --id projects.create
```
Paste the template into Cursor/Codex/Claude with relevant source snippets and apply the suggestions. See [docs/llm-prompt.md](./llm-prompt.md).

## 7. Add a chat/agent surface
Copy `examples/react-app/src/components/AiChat.tsx` and `src/agent/localAgent.ts` (or your own equivalent). Replace the placeholder intent router with a real LLM call:
1. Send the canonical/public manifest to the model as tool definitions.
2. Let the model select a capability and provide structured inputs.
3. Call `runtime.execute` with `handlerContext` adapters.
4. Stream the response back into the chat UI.

## 8. Expose actions to your production agent
- Publish the `.well-known/ai-capabilities.json` endpoint with a safe allowlist.
- Use the server/runtime tooling in this repo (`npx ai-capabilities serve`) to proxy capability execution.
- Gate destructive capabilities with confirmation policies or deny rules.

## 9. Repeat
Each time you add or modify capabilities:
1. Update the capability definition file.
2. Rerun `npx ai-capabilities extract`.
3. Rerun `npx ai-capabilities doctor`.
4. Update your LLM prompt context if needed.

You now have a complete loop: define → extract → doctor → inspect → wire → expose.

Need to troubleshoot (doctor stuck on “Discoverable”, schemas empty, UI adapters missing)? Jump to [docs/faq.md](./faq.md) for symptom → fix guidance before iterating further.

## Run the demo

1. Follow the commands in [scripts/demo-run.md](../scripts/demo-run.md) to install, extract, and start the React example (`npm run dev`).
2. Open `http://localhost:5173`, type `Create a project called Analytics` in the chat.
3. Watch the console: the deterministic agent logs `[agent] intent=...`, executes `projects.create`, then automatically calls `navigation.open-project-page`.
4. Experiment with `List my projects` or `Open project proj_2` to see additional capabilities.

For a narrative view of each step see [docs/demo-scenario.md](./demo-scenario.md).
