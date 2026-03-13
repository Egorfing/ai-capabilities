# Security model

AI Capabilities exposes real application actions. Every capability must carry policy metadata so teams can reason about who can call it, how risky it is, and whether confirmation is required. This document defines those concepts and provides a safe rollout checklist.

## Capability exposure (`visibility`)

| Visibility | Who sees it | Typical use | Notes |
| --- | --- | --- | --- |
| `internal` | In-app or trusted agents only | Default for most capabilities, especially during pilots | Appears in canonical manifest but is omitted from the public manifest unless you explicitly include it. |
| `public` | External agents via `/.well-known/ai-capabilities.json` | Read-only or carefully hardened actions you want 3rd-party agents to call | Requires a curated allowlist and ongoing monitoring; this endpoint acts like `robots.txt`/`sitemap.xml` for executable actions. |
| `hidden` | Not discoverable by agents | Temporary/internal utilities, manual testing hooks | Remains executable inside your runtime, but omitted from manifests so AI tooling cannot see it. |

**Guidance**
- Start with `visibility: "internal"` for all capabilities.
- Promote to `public` only after you have confirmation policies and monitoring in place—whatever lands in `/.well-known/ai-capabilities.json` becomes part of your public discovery contract.
- Use `hidden` for destructive actions that engineers must trigger manually.

## Risk levels (`riskLevel`)

Risk levels describe the blast radius if an agent misuses a capability.

| Risk | Description | Examples |
| --- | --- | --- |
| `safe` | No side-effects, already public information | `status.ping`, `docs.search` |
| `low` | Read-only or harmless UI actions | `projects.list`, `navigation.open-project-page` |
| `medium` | Normal state changes or creation flows | `projects.create`, `reports.update-title` |
| `high` | Destructive operations, privilege changes, irreversible writes | `projects.delete`, `billing.cancel-account` |
| `critical` | Global outages or data loss if misused | `database.drop-table`, `tenant.reset` |

**How to classify**
- Default to `low` unless you are certain the action mutates state.
- Promote to `medium` for any create/update flow, even if reversible.
- Mark `high`/`critical` for deletes, destructive migrations, or flows that affect many users.

## Confirmation policies (`confirmationPolicy`)

Confirmation policies gate execution with an explicit operator check (UI confirmation, approval workflow, etc.).

| Policy | Meaning | When to use |
| --- | --- | --- |
| `none` | Immediate execution | Safe reads and low-risk actions |
| `once` | First execution requires human approval; subsequent calls are cached | Medium-risk changes during pilot |
| `always` | Every execution requires a confirmation step | High/critical risk, destructive flows |

Implement confirmation using your runtime hooks (pre-execution prompts, Slack approvals, etc.).

## Recommended defaults

Until you intentionally change the policy, use:

```ts
policy: {
  visibility: "internal",
  riskLevel: "low",
  confirmationPolicy: "none",
}
```

Conservative defaults keep capabilities discoverable to your internal agent while preventing external exposure.

## Safe pilot setup

Roll out AI control gradually:

1. **Start with read capabilities** — `projects.list`, `metrics.get`. Mark them `visibility: "internal"`, `riskLevel: "low"`.
2. **Allow a small set of mutations** — add `projects.create` with `riskLevel: "medium"` and `confirmationPolicy: "once"`.
3. **Disable destructive capabilities** — keep deletes/exports `hidden` or denylisted.
4. **Run `npx ai-capabilities doctor`** — confirm the project reports “Partially executable” or “Pilot ready”.
5. **Expose a public subset** — once confident, set selected read actions to `visibility: "public"` and republish `/.well-known/ai-capabilities.json`.

Example:

```ts
defineCapability({
  id: "projects.create",
  // ...
  policy: {
    visibility: "internal",
    riskLevel: "medium",
    confirmationPolicy: "once",
  },
});
```

## Dangerous capability examples

Treat the following as `high` or `critical` risk:

- `projects.delete`, `datasets.delete`
- `billing.reset-account`, `user.disable`
- `database.drop*`, `storage.wipe*`

Guard them via any combination of:

```ts
policy: {
  visibility: "hidden",
  riskLevel: "high",
  confirmationPolicy: "always",
}
```

and maintain a denylist in your runtime so they never appear in the public manifest.

## Capability exposure flow

```
extract → inspect → classify risk & visibility → add confirmation policies → doctor → publish
```

- **`npx ai-capabilities inspect --json`** surfaces raw capabilities for review.
- **`npx ai-capabilities prompt --template allowlist`** helps classify risk before publishing.
- **`npx ai-capabilities doctor`** warns if destructive IDs are marked low risk or exposed publicly.
- **`npx ai-capabilities serve`** should only publish the curated public manifest.

Follow this loop whenever you add or modify a capability to keep security posture explicit and auditable.
