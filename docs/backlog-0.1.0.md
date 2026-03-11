# Backlog — 0.1.0 Pre-Release Sweep

Short list of pain points discovered during packaging, smoke install, and pilot validation.

## Packaging

1. **Include dependency install instructions (severity: medium)** — Smoke install in offline environments required copying the monorepo `node_modules`. Need documented offline workflow or switch to bundling critical deps when packaging for pilots. *Next step:* evaluate whether to publish to a temporary registry for easier testing or add `bundledDependencies`.
2. **Repository metadata missing (severity: medium)** — `repository`, `homepage`, and `bugs` fields cannot be filled without final Git hosting info. *Next step:* set canonical GitHub URL before releasing.

## DX / CLI

1. **CLI relies on pre-built dist (severity: low)** — All npm scripts use `tsx`, which may fail in restricted environments. *Next step:* add `npm run cli:<cmd>` wrappers that execute compiled artifacts to avoid `tsx` pipes.

## Extraction Quality

1. **No executable bindings in demo pilot (severity: medium)** — Inspect shows 0/16 capabilities executable because handler bindings aren’t configured. *Next step:* add sample bindings or document binding flow earlier.

## Runtime / Binding

1. **Manual binding registry only (severity: medium)** — No auto-http binding fallback beyond manifest metadata, leaving everything “unbound”. *Next step:* implement HTTP binding inference for common API patterns.

## Docs / Onboarding

1. **Smoke install caveat (severity: low)** — README/docs should mention that release tarball currently expects internet access to fetch dependencies. *Next step:* add note to README + docs/testing.

## Public Agent Surface

1. **No automated public manifest validation (severity: low)** — Well-known endpoint trusts manifest inputs. *Next step:* add contract test comparing `.well-known` output to sanitized public manifest snapshot.
