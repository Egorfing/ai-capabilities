# `ai-capabilities doctor`

`doctor` is a read-only troubleshooting command that inspects your project and reports what is configured, what is missing, and the next steps to become pilot-ready.

```bash
npx ai-capabilities doctor
npx ai-capabilities doctor --json
npx ai-capabilities doctor --project ../app --config ./ai-capabilities.config.json
```

## What it checks
- **Config** – whether `ai-capabilities.config.json` exists and parses.
- **Output artifacts** – raw/canonical/public/enriched manifests, diagnostics, traces.
- **Capabilities** – total count, by kind/visibility, executable vs unbound, high-risk/confirmation stats.
- **Executability** – uses existing manifest execution data/bindings to flag unbound capabilities.
- **Local scaffold** – detects `src/ai-capabilities/` registry + example capability.
- **Safety** – heuristic warnings for public high-risk actions or destructive identifiers.
- **Pilot readiness** – classifies the integration (Not initialized → Pilot ready).

## Sample output
```
Status: Discoverable (unbound)
Project: /Users/dev/my-app
Config: OK (/Users/dev/my-app/ai-capabilities.config.json)

Outputs:
- Raw manifest: present (output/capabilities.raw.json)
- Canonical manifest: present (output/ai-capabilities.json)
- Public manifest: present (output/ai-capabilities.public.json)
- Enriched manifest: missing (output/ai-capabilities.enriched.json)
- Diagnostics: present (output/diagnostics.log)
- Traces: missing (output/traces)

Capabilities:
- Total: 14 • Public: 0 • Executable: 0 • Unbound: 14
- Requires confirmation: 2 • High risk: 1

Issues:
- [medium] Capabilities exist but bindings/execution details are missing.
- [low] Enriched manifest not found. Run `npx ai-capabilities enrich`.

Recommended next steps:
  1. Register capabilities or add execution bindings
  2. Run npx ai-capabilities enrich
```

With `--json`, the report becomes machine-readable:
```json
{
  "status": "discoverable",
  "configOk": true,
  "capabilityStats": {
    "total": 14,
    "publicCount": 0,
    "executable": 0,
    "unbound": 14
  },
  "issues": [
    {
      "code": "NO_EXECUTABLE_CAPABILITIES",
      "severity": "medium",
      "message": "Capabilities exist but bindings/execution details are missing."
    }
  ]
}
```

## Status levels
| Status | Meaning |
| --- | --- |
| `not_initialized` | Config missing. Run `npx ai-capabilities init`. |
| `initialized` | Config present but no manifests yet. Run `npx ai-capabilities extract`. |
| `extracted` | Canonical manifest exists but contains no capabilities. Add manual definitions or new extractors. |
| `discoverable` | Capabilities exist but are all unbound (no execution). Register handlers. |
| `partially_executable` | Some capabilities execute but none are public. Prepare a public/pilot surface. |
| `pilot_ready` | Canonical manifest present, at least one executable capability, and a public surface exists. Review safety warnings before launch. |

## Recommended workflow
1. `npx ai-capabilities init`
2. `npx ai-capabilities extract`
3. `npx ai-capabilities doctor`
4. Address the next steps (enrich, register execution, create allowlist)
5. Rerun `doctor` until the status reaches “Pilot ready”.
