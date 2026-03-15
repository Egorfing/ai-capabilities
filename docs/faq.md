# FAQ & Troubleshooting

Use this reference whenever `doctor`, `inspect`, or your UI shows unexpected behavior. Copy/paste solutions into your workflow and rerun the CLI commands to verify the fix.

For guided onboarding see [docs/happy-path.md](./happy-path.md) and [docs/llm-onboarding-workflow.md](./llm-onboarding-workflow.md). For prompt templates jump to [docs/llm-prompt.md](./llm-prompt.md), and keep [README.md](../README.md) handy for the overall CLI map.

## Getting Started Issues

**Q: `npx ai-capabilities doctor` says “Not initialized”.**
- **Cause:** `ai-capabilities.config.json` is missing.
- **Fix:**
  ```bash
  npx ai-capabilities init
  ```
  Then rerun `doctor`.

**Q: `npx ai-capabilities doctor` reports “Canonical manifest missing”.**
- **Cause:** `npx ai-capabilities extract` hasn’t been run since the last change.
- **Fix:**
  ```bash
  npx ai-capabilities extract
  npx ai-capabilities doctor
  ```

**Q: Why do I have both \`src/app-capabilities\` and \`output/\` directories?**
- **Answer:** They serve different purposes:
  - `src/app-capabilities/**/*` is authored code—capability definitions, registries, runtime helpers, and frontend adapters that you own and review.
  - `output/**/*` is generated data—manifests, diagnostics, and traces produced by CLI commands (`extract`, `inspect`, `enrich`, `trace`). Delete/regenerate these instead of editing them manually.
- **Workflow:** Run `extract`/`inspect` to populate `output/`, pick the extracted ids you care about, then convert them into executable code under `src/app-capabilities` (often via `defineCapabilityFromExtracted` or the `scaffold` command).

**Q: Can I generate safe capability files in bulk?**
- **Answer:** Yes. Use the auto-bind helper:
  ```bash
  npx ai-capabilities auto-bind --manifest ./output/ai-capabilities.json --dir ./src/app-capabilities/auto --dry-run
  ```
  Review the plan, rerun without `--dry-run`, then register the generated files (they land in `src/app-capabilities/auto/`). Auto-bind only targets safe reads and create/update mutations and skips destructive IDs so you can scaffold those manually.

## Extraction Issues

**Q: `inspect` shows capabilities but `inputSchema` is empty.**
- **Cause:** The extractor could not infer parameters (common for custom hooks/functions).
- **Fix:** Manually edit the capability definition or ask an LLM to infer the schema:
  ```bash
  npx ai-capabilities prompt --template backend --file ./output/ai-capabilities.json --id hook.create-project-mutation
  ```
  Paste the template + source snippet into your assistant, review the output, and update the capability file.

**Q: `inspect` shows duplicate sources.**
- **Cause:** Multiple extractors detected the same logical action (e.g., OpenAPI/Swagger spec + React Query hook).
- **Fix:** Adjust `paths.include/exclude` in `ai-capabilities.config.json`, or centrally define the capability via `defineCapability` and exclude overlapping files.

## Runtime Issues

**Q: Why are my capabilities “unbound”? / `doctor` says “Discoverable but not executable”.**
- **Cause:** Extraction only lists actions; execution requires explicit bindings (`defineCapability` + registry wiring). Until registration happens, doctor treats them as discoverable-only.
- **Fix:** Define each capability with `defineCapability` and register it:
  ```ts
  import { registerCapabilityDefinitions } from "ai-capabilities";
  registerCapabilityDefinitions(registry, [createProjectCapability]);
  ```
  Verify that your runtime (see `examples/react-app/src/app-capabilities/registry.ts`) is imported before `runtime.execute` is called, then rerun `npx ai-capabilities doctor`.

**Q: Runtime returns `HANDLER_NOT_FOUND`.**
- **Cause:** Capability not registered in your `CapabilityRegistry`.
- **Fix:** Ensure your runtime code calls `registerCapabilityDefinitions` with every capability module before invoking `runtime.execute`.

## Frontend Capability Issues

**Q: My frontend capability doesn’t execute.**
- **Cause:** The handler references `ctx.router`/`ctx.ui`, but `handlerContext` was not passed to the runtime.
- **Fix:** Inject adapters at execution time:
  ```ts
  await runtime.execute(request, {
    handlerContext: {
      router: { navigate: (path) => appRouter.push(path) },
      ui: { openPanel: ... }
    }
  });
  ```
  Mirror the pattern from `examples/react-app/src/agent/runtime.ts`.

**Q: My navigation capability doesn’t do anything.**
- **Cause:** Router/UI adapters aren’t provided via `handlerContext`.
- **Fix:**
  ```ts
  await runtime.execute(request, {
    handlerContext: {
      router: { navigate: (path) => appRouter.push(path) },
      ui: { openPanel: ... },
      notify: { info: toast }
    }
  });
  ```
  Compare with `examples/react-app/src/agent/runtime.ts`.

**Q: Frontend capability executes but nothing happens in the UI.**
- **Cause:** The capability references undefined adapters (e.g., `ctx.ui.openModal` when `openModal` isn’t provided).
- **Fix:** Pass concrete adapters, or guard in the capability (`ctx?.ui?.openModal?.(...)`).

**Q: Why does doctor still say “Discoverable but not executable” after I add UI capabilities?**
- **Cause:** Doctor only considers capabilities executable when a runtime binding exists. Pure UI definitions that never register with the runtime (or lack context adapters) remain unbound.
- **Fix:** Ensure you export your capability array from `src/app-capabilities/index.ts`, import it wherever you construct the runtime, and provide the `handlerContext` adapters shown above.

## Safety Questions

**Q: How do I disable destructive actions (“delete”, “remove”)?**
- **Fixes:**
  - Mark the capability as internal:
    ```ts
    policy: { visibility: "internal" }
    ```
  - Require confirmation:
    ```ts
    policy: { confirmationPolicy: "once" }
    ```
  - Maintain a denylist in your server/runtime before publishing `.well-known/ai-capabilities.json`.
  - Follow the classification guidance in [docs/security-model.md](./security-model.md) and keep destructive actions `hidden` or `high` risk with `confirmationPolicy: "always"`.

**Q: How do I decide which risk/confirmation values to use?**
- **Answer:** Use the decision tables in [docs/security-model.md](./security-model.md). Start low/internal by default, bump to `medium` + `once` for mutations, and require `always` for deletes or `public` exposure.

**Q: Doctor warns about public high-risk capabilities.**
- **Fix:** either downgrade visibility to `internal`, add a confirmation policy, or remove them from the public manifest until policies are in place.

## External agent exposure

**Q: How do I expose capabilities to external agents?**
- **Cause:** The `.well-known/ai-capabilities.json` endpoint is missing or contains internal-only actions.
- **Fix:**
  1. Run `npx ai-capabilities extract` to regenerate `output/ai-capabilities.public.json`.
  2. Start the server with `npx ai-capabilities serve --config <config>` so that `GET /.well-known/ai-capabilities.json` returns the public manifest.
  3. Optionally curate a safe allowlist via `npx ai-capabilities prompt --template allowlist` before publishing.
  4. Follow the hardening checklist in [docs/external-agents.md](./external-agents.md) and review `examples/react-app/server.ts` (or whichever sample exposes `.well-known`).
  5. Point your model provider (OpenAI/Anthropic/internal agent) at the `.well-known` URL when registering tools.

## LLM Integration Issues

**Q: The LLM keeps choosing the wrong capability.**
- **Cause:** Missing aliases / vague descriptions.
- **Fix:** Improve metadata and regenerate prompts:
  ```bash
  npx ai-capabilities prompt --template improve --file ./output/ai-capabilities.json --id projects.create
  ```
  Add user-language aliases and example intents.

**Q: LLM output doesn’t match the schema.**
- **Fix:**
  - Make sure schemas include required fields and examples.
  - Provide the canonical manifest to the model as tool definitions.
  - Add validation/tooling on the agent side to reject malformed payloads.

## Common Mistakes

| Symptom | Explanation | Fix |
| --- | --- | --- |
| Doctor: “Discoverable (unbound)” | No execution bindings | Register capabilities with `registerCapabilityDefinitions` or add `execution` metadata. |
| Server 404 at `/.well-known/ai-capabilities.json` | `npx ai-capabilities serve` not running or config paths wrong | Start the server with the same config used for extraction. |
| All capabilities marked public | Didn’t set `policy.visibility` | Set `visibility: "internal"` unless you explicitly want it public. |
| Frontend actions no-op | Missing router/ui adapters | Pass adapters through `handlerContext`. |
| LLM suggests nonexistent inputs | Schema incomplete | Use the prompt workflow to refine schema/metadata. |
| Running `serve` before `extract` | Output files missing | Always run `npx ai-capabilities extract` first. |
| Public endpoint exposes everything | `.well-known` serving canonical manifest instead of public | Serve `ai-capabilities.public.json` via `npx ai-capabilities serve` or filter via `docs/external-agents.md`. |

## Troubleshooting Command Flow

1. `npx ai-capabilities doctor` — high-level readiness + next steps.
2. `npx ai-capabilities extract` — regenerate manifests after edits.
3. `npx ai-capabilities inspect --json` — detailed capability inventory.
4. `npx ai-capabilities prompt --template <backend|frontend|improve|allowlist>` — fill metadata gaps with an LLM.
5. `npx ai-capabilities enrich` — optional enrichment for user-friendly descriptions.

Re-run doctor after each change to confirm status moves toward “Pilot ready”.

## Where to see a working setup
- `examples/react-app` — full backend + read + navigation capabilities, runtime context, and chat UI.
- `docs/happy-path.md` — end-to-end walkthrough.
- `docs/file-structure.md` — file layout reference.
