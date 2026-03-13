# Capability chaining

Agents rarely stop at a single action. “Create a project called Analytics and open it” requires two capabilities executed in sequence. This document explains how to implement chaining logic and keep it safe.

## Why chaining matters
- **User intent ≠ single tool** — conversational requests often imply follow-up actions (create → navigate, upload → share).
- **Stateful UX** — after executing an API mutation you often want to update the UI, refresh caches, or guide the user to the result.
- **Deterministic demos** — chaining shows how AI Capabilities can drive an entire workflow without custom orchestration frameworks.

## Basic pattern

1. **Plan** — parse/interpret the user message to identify one or more capability IDs plus inputs.
2. **Execute** — call the runtime for the first capability and inspect the result.
3. **Decide** — based on success + response payload, enqueue the next capability.
4. **Repeat** — continue until the intent is satisfied or an error occurs.

Pseudo-code:

```ts
const plan: CapabilityInvocation[] = [{ id: "projects.create", input: { name } }];
if (shouldOpenAfterCreate) {
  plan.push({ id: "navigation.open-project-page", input: (result) => ({ projectId: result.id }) });
}

const events: CapabilityExecutionResult[] = [];
for (const step of plan) {
  const input = typeof step.input === "function" ? step.input(events.at(-1)?.data ?? {}) : step.input;
  const result = await runtime.invoke(step.id, input);
  events.push(result);
  if (result.status !== "success") break;
}
```

## Example: create → navigate

`examples/react-app/src/agent/localAgent.ts` implements a deterministic agent:

- User message contains “create project” → plan `projects.create`.
- Unless the user wrote “don’t open”, the agent immediately calls `navigation.open-project-page` with the ID returned by the first capability.
- `[agent]` and `[runtime]` console logs show each step so you can trace the flow without an external LLM.

Try it live via `cd examples/react-app && npm run dev` and send “Create a project called Analytics”.

## Safety considerations

- **Policy enforcement** — each capability still honors `visibility`, `riskLevel`, and `confirmationPolicy`. Chaining simply reuses the runtime, so destructive follow-ups require confirmation like any other action.
- **Result validation** — do not assume a capability succeeded. Inspect `result.status` and stop the chain on errors.
- **Input derivation** — when the second capability needs output from the first (e.g., project ID), derive it from the runtime result rather than recomputing.
- **LLM transparency** — surface a transcript to the user (chat history or audit log) so they understand which actions executed.

## When to chain

- Post-mutation navigation (create/edit → open detail view).
- Multi-step flows (upload file → start processing → notify when done).
- Safety hand-offs (draft destructive action → ask for confirmation capability).

For complex workflows you can still rely on an LLM planner, but the core idea stays the same: plan → execute → observe → next capability.
