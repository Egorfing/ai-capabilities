# React app integration example

This example mimics a minimal product UI that exposes three capabilities to an in-app AI agent:

1. `projects.create` — backend mutation capability
2. `projects.list` — read capability
3. `navigation.open-project-page` — UI/navigation capability

This repo demonstrates:

- **defineCapabilityFromExtracted** — see `src/app-capabilities/capabilities/createProject.ts` and `listProjects.ts`.
- **UI capabilities** — `openProjectPage.ts` calls router adapters via `ctx.router`.
- **CapabilityRuntime** — `src/agent/runtime.ts` wires manifest + registry + adapters.
- **Deterministic agent loop** — `src/agent/localAgent.ts` chooses capabilities without real LLM calls.

The folder demonstrates the recommended structure:

```
examples/react-app/
  src/
    ai-capabilities/
      capabilities/
        createProject.ts
        listProjects.ts
        openProjectPage.ts
      registry.ts
      index.ts
    agent/
      runtime.ts
      localAgent.ts
    data/
      projectStore.ts
    components/
      AiChat.tsx
    App.tsx
```

> This is a teaching artifact. You can copy these files into your own app and wire them up to your actual router, API clients, and LLM provider. See the file map above to locate the relevant concepts quickly.

## Run the demo locally

```bash
cd examples/react-app
npm install
npm run dev
```

Open `http://localhost:5173` and try prompts such as:

- `Create a project called Analytics`
- `List my projects`
- `Open project proj_1`

Watch your terminal for `[agent]` / `[runtime]` logs that describe chaining (create → navigation). The UI chat mirrors what an AI assistant would say to an end user.

## Reusing the pattern in your app
1. Install dependencies in your app (`npm install ai-capabilities react`).
2. Copy the `src/app-capabilities` folder and adjust the handlers to call real APIs.
3. Wire the runtime in `agent/runtime.ts` to pass your router/ui/notify adapters.
4. Drop `AiChat.tsx` into your UI and replace the placeholder agent logic with a real LLM.
5. Use `npx ai-capabilities init`, `extract`, `doctor`, and `inspect` as described in [docs/happy-path.md](../../docs/happy-path.md).

## Where to hook a real LLM
Inside `src/agent/localAgent.ts`, replace the `planFromText` helper with a call to OpenAI/Anthropic/etc. Feed the agent the canonical/public manifest (generated via `npx ai-capabilities extract`) so it can choose tools.

## Using doctor and inspect
After defining your capabilities, run:
```
npx ai-capabilities extract
npx ai-capabilities doctor
npx ai-capabilities inspect --json | jq
```
These commands validate that manifests exist, capabilities are bound, and the project is ready for a first pilot.

Refer to [docs/file-structure.md](../../docs/file-structure.md) for a deeper description of each file.
