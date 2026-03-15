# Demo scenario — “Create & open project”

This scenario demonstrates how AI Capabilities lets an agent interpret a user request, choose the right capability, execute it safely, and update the UI — all without external API keys.

## Flow overview

```
User → Local agent → Capability runtime → Application data/UI
```

1. **User** types: `Create a project called Analytics`.
2. **Local agent** (`examples/react-app/src/agent/localAgent.ts`) parses the intent and plans two capability calls:
   - `projects.create` (mutation)
   - `navigation.open-project-page` (UI action)
3. **Capability runtime** (`examples/react-app/src/agent/runtime.ts`) validates policies and executes handlers from `src/app-capabilities/capabilities`.
4. **UI** (`examples/react-app/src/components/AiChat.tsx`) renders chat messages and shows console logs for each capability invocation.

## Step-by-step

| Step | Component | What happens | Code |
| --- | --- | --- | --- |
| 1 | User input | Developer enters a natural-language command in AiChat. | `examples/react-app/src/components/AiChat.tsx` |
| 2 | Intent → plan | The rule-based agent inspects the string, classifies it as “create project”, and prepares a capability queue. | `createPlanFromText` in `examples/react-app/src/agent/localAgent.ts` |
| 3 | Capability execution | The runtime executes `projects.create`, persisting data in the in-memory store. | `examples/react-app/src/app-capabilities/capabilities/createProject.ts` |
| 4 | Result handling | The agent logs the result, replies in chat, and immediately runs `navigation.open-project-page` with the new ID. | `executePlan` in `localAgent.ts` |
| 5 | UI feedback | The runtime injects router/ui adapters so the navigation capability pushes the new route and triggers a toast. | `examples/react-app/src/agent/runtime.ts` + `AiChat.tsx` |

Expected console output:

```
[agent] intent=createProject name=Analytics
[agent] executing projects.create {"name":"Analytics"}
[runtime] capability result {"id":"proj_3","name":"Analytics"}
[agent] follow-up navigation.open-project-page {"projectId":"proj_3"}
[runtime] navigation result {"opened":true,"projectId":"proj_3"}
```

## Try it

1. Run the commands from [scripts/demo-run.md](../scripts/demo-run.md).
2. Open the React app (default `npm run dev` → `http://localhost:5173`).
3. Send: `Create a project called Analytics`.
4. Watch the chat transcript plus console logs that list each capability invocation.

For more guided onboarding see [docs/happy-path.md](./happy-path.md). When you are ready to connect a real model, swap the deterministic agent for your LLM interface while keeping the same capabilities and runtime.

## Public discovery variant
If you expose the runtime over HTTP, an external agent would follow this minimal loop:

1. `GET https://app.example.com/.well-known/ai-capabilities.json` – discover every public capability (similar spirit to `robots.txt` or `openapi.json`).
2. Parse `projects.create`, note its schema/policy, and register it as a tool/function.
3. When the user asks “Create a project called Analytics”, the agent validates the payload against the schema.
4. `POST https://app.example.com/execute` with `{ "capabilityId": "projects.create", "input": { "name": "Analytics" } }`.
5. Handle the runtime response and continue the conversation.

Internal-only actions stay in the canonical manifest, so you can run the local demo while treating `/.well-known` as the formal discovery bridge for partner agents.
