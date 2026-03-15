# Step-by-step plan: AI capability extraction + agent runtime

This plan assumes an **empty workspace** and running **one step at a time** with Codex / Cursor / Claude Code (or any coding assistant).

## How to use this plan

1. Create an empty project folder.
2. Drop this file in as `PLAN.md`.
3. Execute **one stage at a time**.
4. For each stage, tell the agent only:
   - the stage goal,
   - the list of tasks,
   - the done criteria.
5. Do **not** ask the agent to complete multiple stages at once.
6. After every stage, run the project locally and capture the result.

---

# Overall project goal

Build an MVP platform that:

- extracts app capabilities from source code,
- produces a single capability manifest,
- lets any LLM choose from allowed actions,
- executes actions via one runtime,
- logs every step for debugging,
- can eventually be exposed to external agents.

---

# MVP outcome

The project should be able to:

1. Inspect a React/TypeScript app.
2. Extract capabilities from OpenAPI, React Query, router, and forms/schemas.
3. Store data in `capabilities.raw.json`.
4. Enrich it into `capabilities.enriched.json`.
5. Expose capabilities as tools for different models.
6. Accept capability execution requests.
7. Validate inputs.
8. Run handlers.
9. Save traces/logs of each execution.

---

# Stage 0. Repository initialization

## Goal
Lay the project foundation so architecture, parsers, runtime, and adapters stay organized.

## Tasks

- Initialize a Node.js/TypeScript project.
- Configure `package.json`.
- Configure `tsconfig.json`.
- Create the base folder structure.
- Add eslint/prettier or a minimal formatter.
- Add essential scripts.

## Suggested layout

```
.
├─ src/
│  ├─ core/
│  ├─ extractors/
│  ├─ enrich/
│  ├─ runtime/
│  ├─ adapters/
│  ├─ server/
│  ├─ types/
│  ├─ utils/
│  └─ cli/
├─ fixtures/
├─ output/
├─ docs/
├─ package.json
├─ tsconfig.json
└─ PLAN.md
```

## Agent should

- scaffold a TypeScript project,
- propose minimal dependencies,
- create the directory skeleton,
- add npm scripts (`build`, `dev`, `lint`, `extract`, `test`).

## Done when

- project builds without errors,
- directory structure is clear,
- essential npm scripts exist,
- no unnecessary dependencies.

---

# Stage 1. Capability data model

## Goal
Lock down the data contract before writing extractors/runtime.

## Tasks

Define types for:

- `RawCapability`
- `EnrichedCapability`
- `CapabilityManifest`
- `CapabilityExecutionRequest`
- `CapabilityExecutionResult`
- `TraceEvent`
- `ModelToolDefinition`

### `RawCapability` should include
`id`, `source`, `kind`, optional `title/description`, `inputSchema`, optional `outputSchema/effects/tags/permissions`, `metadata`.

### `EnrichedCapability` adds
`displayTitle`, `userDescription`, `aliases`, `exampleIntents`, `confirmationPolicy`, `riskLevel`, `visibility`.

## Agent should

- design types under `src/types/`,
- define enums/unions sparingly,
- keep contracts simple but extensible.

## Done when

- a single type system exists,
- types compile,
- types serve both runtime internals and future external agents.

---

# Stage 2. Capability manifest format

## Goal
Define a JSON format that can be generated, consumed by agents, exposed externally, and logged.

## Tasks

- Create example `capabilities.raw.json`.
- Create example `capabilities.enriched.json`.
- Provide a JSON Schema for the manifest.
- Handcraft 3–5 sample capabilities.

### Sample categories
`read`, `mutation`, `navigation`, `ui-action`, `workflow`.

## Agent should

- create `docs/contract/` (or similar) with the examples,
- ensure schemas cover required/optional fields.

## Done when

- example files exist,
- schemas describe the contract,
- categories cover the intended use cases.

---

(Continue with further stages as needed.)
