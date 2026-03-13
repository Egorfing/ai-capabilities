import type { AiCapability } from "../types/index.js";

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function buildBackendPrompt(capability: AiCapability): string {
  return [
    "# Backend/API Capability Completion Prompt",
    "You are helping define an AI capability from real project code. Use only the provided context.",
    "## Existing capability data",
    "```json",
    formatJson(capability),
    "```",
    "## Tasks",
    "1. Derive accurate `displayTitle` and `userDescription` that describe the user-visible action.\n2. Produce meaningful `aliases` and `exampleIntents` grounded in real usage.\n3. Infer the input schema (type, properties, required fields) from the underlying hook/query/mutation. Distinguish required vs optional.\n4. Recommend `riskLevel`, `visibility`, and `confirmationPolicy`.\n5. Provide a complete `defineCapability(...)` snippet using the helper API, including schema, aliases, policy, and an outline of the execute handler (comments are fine if implementation is unknown).",
    "## Rules",
    "- Do **not** invent fields that lack evidence.\n- Highlight uncertainties (e.g., `// TODO: confirm if description is required`).\n- Prefer the actual client payload over raw DTOs if they differ.\n- Mention any assumptions explicitly.",
    "## Output format",
    "Respond with:\n1. A short summary of findings.\n2. Updated capability metadata (title, description, aliases, exampleIntents, policy) as JSON.\n3. A `defineCapability` snippet in TypeScript.",
  ].join("\n\n");
}

export function buildFrontendPrompt(capability: AiCapability): string {
  return [
    "# Frontend/UI Capability Completion Prompt",
    "Goal: describe a local UI/navigation action so an AI agent can invoke it via defineCapability.",
    "## Existing signal",
    "```json",
    formatJson(capability),
    "```",
    "## Tasks",
    "1. Determine whether this is navigation or UI action (`kind: \"navigation\"` or `\"ui-action\"`).\n2. Provide a precise `displayTitle`, `description`, `aliases`, and `exampleIntents` focused on the user workflow.\n3. Define the `inputSchema` with required parameters (IDs, filters, view modes).\n4. Recommend `policy` (visibility, risk, confirmation).\n5. Draft a `defineCapability` snippet that calls local helpers via `ctx.router`, `ctx.ui`, or `ctx.notify`. No browser automation or DOM scripting—just explicit app-local calls.",
    "## Rules",
    "- Keep the action deterministic and minimal (single navigation or modal open).\n- Do not invent backend calls.\n- Emphasize app-provided context instead of framework-specific APIs unless unavoidable.\n- Call out any missing context as TODO comments.",
    "## Output format",
    "1. Bullet list of inferred inputs/assumptions.\n2. Recommended metadata (JSON).\n3. `defineCapability` snippet ready for the codebase.",
  ].join("\n\n");
}

export function buildImprovementPrompt(capability: AiCapability): string {
  return [
    "# Capability Improvement Prompt",
    "Review the capability below and suggest concrete improvements.",
    "## Current capability",
    "```json",
    formatJson(capability),
    "```",
    "## Tasks",
    "1. Identify unclear or placeholder fields (title, description, schemas, aliases, policy).\n2. Recommend better wording and richer metadata.\n3. Suggest additional aliases/example intents that match user language.\n4. Flag missing validation or policy requirements.\n5. Provide an improved `defineCapability` snippet or diff.",
    "## Output format",
    "- `Findings:` numbered list.\n- `Updated metadata:` JSON with suggested values.\n- `Code:` improved snippet or patch.",
  ].join("\n\n");
}

export function buildAllowlistPrompt(capabilities: AiCapability[]): string {
  const table = capabilities
    .slice(0, 50)
    .map((cap) => `- ${cap.id} [${cap.kind ?? "unknown"}] — ${cap.displayTitle ?? cap.description ?? "(no title)"}`)
    .join("\n");
  return [
    "# Capability Safety Review Prompt",
    "Goal: recommend a safe allowlist/denylist for the first pilot run. Bias toward safety.",
    "## Capability sample",
    table || "(No capabilities provided)",
    "## Tasks",
    "1. Categorize capabilities into: safe reads, safe mutations (low risk), risky/destructive mutations, internal-only, candidate public endpoints.\n2. Justify each decision briefly.\n3. Recommend a minimal allowlist for external agents.\n4. Call out any capabilities that require human confirmation or additional policy.",
    "## Output format",
    "Respond with sections: `Safe Reads`, `Safe Mutations`, `Dangerous`, `Internal Only`, `Public Candidates`, each as bullet lists with reasoning.",
  ].join("\n\n");
}
