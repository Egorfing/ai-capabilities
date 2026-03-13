# LLM prompt workflow

LLMs are great at filling the semantic gaps after extraction: naming capabilities, refining schemas, and proposing UI actions. This guide provides copy-paste prompts for coding assistants (Cursor, Claude Code, Copilot Chat, etc.) so you can stay in control while letting an LLM draft the missing bits.

Need a full project-aware onboarding (diagnose repo → detect AI stack → ask only missing questions → generate files)? Use [docs/llm-onboarding-workflow.md](./llm-onboarding-workflow.md). Use this prompts document for focused edits to individual capabilities once the integration path is already chosen.

For the CLI sequence see the onboarding quick start in [README.md](../README.md) or [docs/happy-path.md](./happy-path.md). Troubleshooting and FAQs live in [docs/faq.md](./faq.md).

## When to use prompts
- You have raw/extracted capabilities with placeholder metadata.
- You need to transform a hook/query/mutation into a production-ready `defineCapability` entry.
- You want a second opinion on risk/visibility or wording.
- You are deciding which capabilities are safe for a pilot allowlist.

Always validate the LLM output before merging it. Treat the prompts as structured checklists, not automation.

## Backend/API capability completion
Use this when refining a server/API capability (e.g., `hook.create-project-mutation`).

```
You are helping define an AI capability from real project code. Use only the provided context.

### Context
- Source snippet / hook implementation:
  <paste relevant TypeScript/React Query hook or API function>
- DTO or payload types:
  <paste type definitions>
- Extracted capability JSON:
  <paste capability object>

### Tasks
1. Derive accurate `displayTitle` + `userDescription` for humans.
2. Produce `aliases` and `exampleIntents` grounded in how users talk.
3. Infer `inputSchema` (type, properties, required/optional). Prefer the client payload over raw DTOs if they differ.
4. Recommend `riskLevel`, `visibility`, `confirmationPolicy` with justification.
5. Draft a `defineCapability` snippet (include schema, aliases, policy, execute stub). Highlight TODOs instead of inventing behavior.

### Rules
- Do **not** add fields without evidence.
- Distinguish clearly between required/optional inputs.
- Mark uncertainty with comments (e.g., `// TODO: confirm project description is optional`).
- Assume no browser automation.

### Output format
1. Summary of findings.
2. Updated metadata as JSON.
3. `defineCapability` snippet.
```

### Example (backend)
Input capability:
```json
{
  "id": "hook.create-project-mutation",
  "kind": "mutation",
  "displayTitle": "useCreateProjectMutation",
  "description": "useCreateProjectMutation",
  "inputSchema": { "type": "object", "properties": {} }
}
```
Paste the hook implementation (`useCreateProjectMutation`) plus DTO types. The LLM will suggest a title such as “Create workspace project”, infer `name`/`description` inputs, add aliases like “create project”, and produce a `defineCapability` stub.

## Frontend/UI capability completion
Use this for navigation/modals/flows that run locally (e.g., `navigation.open-project-page`).

```
Goal: describe a local UI/navigation action so an AI agent can invoke it via `defineCapability`.

### Context
- UI component / router snippet:
  <paste relevant React component, router config, or UI helper>
- Current capability JSON (if any):
  <paste capability object>

### Tasks
1. Decide if this is `kind: "navigation"` or `"ui-action"`.
2. Provide `displayTitle`, `description`, `aliases`, `exampleIntents`.
3. Define `inputSchema` (IDs, filters, view modes, defaults).
4. Recommend policy (visibility/risk/confirmation).
5. Draft a `defineCapability` snippet that calls `ctx.router`, `ctx.ui`, or `ctx.notify`. No DOM scripting or browser automation.

### Rules
- Keep the action minimal and deterministic (open a modal, navigate to a path, focus an entity).
- Use app-local helpers; if unsure, include TODO comments instead of guessing frameworks.
- Mention assumptions explicitly.

### Output format
1. Bullet list of inferred inputs/assumptions.
2. Metadata JSON.
3. `defineCapability` snippet using the helper API.
```

### Example (frontend)
Input capability:
```json
{
  "id": "navigation.open-project-page",
  "kind": "navigation",
  "displayTitle": "Project page",
  "description": "Project page"
}
```
Paste the router or page component referencing the project route. The LLM should propose `projectId` input, `ctx.router.navigate(\`/projects/${projectId}\`)`, and aliases like “open project detail”.

## Capability improvement prompt
Use when you already have a capability but want better wording or metadata.

```
Review the capability below and suggest concrete improvements.

### Capability
<current defineCapability snippet or manifest JSON>

### Tasks
1. Identify unclear placeholders (title, description, schema, aliases, policy).
2. Recommend better wording/metadata.
3. Suggest aliases/example intents using user language.
4. Flag missing validation or policy safeguards.
5. Provide an improved snippet or diff.

### Output
- `Findings:` numbered list.
- `Updated metadata:` JSON with proposed values.
- `Code:` improved snippet or patch.
```

## Safe pilot allowlist prompt
Use when triaging extracted capabilities for a first pilot.

```
Goal: recommend a safe allowlist/denylist for an initial AI pilot. Bias toward safety.

### Capabilities
<paste list of capability IDs, kinds, titles>

### Tasks
1. Categorize into: Safe Reads, Safe Mutations, Dangerous/Destructive, Internal Only, Candidate Public endpoints.
2. Justify each classification briefly.
3. Recommend a minimal allowlist for external agents.
4. Flag capabilities requiring human confirmation or extra policy.

### Output
Sections with bullet lists + reasoning for each category.
```

## CLI helper: `ai-capabilities prompt`
Use the built-in helper to prefill prompts with capability JSON:

```bash
npx ai-capabilities prompt --template backend --file ./output/ai-capabilities.json --id hook.create-project-mutation
npx ai-capabilities prompt --template frontend --file ./output/ai-capabilities.json --id navigation.open-project-page
npx ai-capabilities prompt --template improve --file ./output/ai-capabilities.json --id modal.open-create-chart
npx ai-capabilities prompt --template allowlist --file ./output/ai-capabilities.json
```

Paste the generated text into your coding assistant, add any relevant source code snippets, and follow the “Tasks” list.

## Validation checklist
- Does the suggested schema match actual arguments?
- Are optional fields clearly marked?
- Does the policy align with security expectations?
- Are aliases/example intents grounded in product language?
- Did you review the generated code before committing?

Keep humans in the loop—LLMs are assistants, not authorities.
