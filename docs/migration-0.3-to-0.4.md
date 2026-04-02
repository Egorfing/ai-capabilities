# Migration guide: 0.3.x to 0.4.x

This guide walks you through upgrading an existing ai-capabilities project from version 0.3.x to 0.4.x. The 0.4.0 release includes breaking changes around directory layout and manifest handling that require manual steps.

## Step 1: Update the package

```bash
npm install ai-capabilities@^0.4.0
```

## Step 2: Rename the scaffold directory

In 0.4.0 the default scaffold directory changed from `src/ai-capabilities` to `src/app-capabilities`. The CLI auto-detects the legacy path and warns once per command, but you should rename it to silence the warning and align with the new convention.

```bash
mv src/ai-capabilities src/app-capabilities
```

After renaming, update any import paths in your code that reference the old directory:

```diff
-import { myCapability } from "./ai-capabilities/my-capability.js";
+import { myCapability } from "./app-capabilities/my-capability.js";
```

If you use path aliases in `tsconfig.json` or bundler config, update those as well:

```diff
 "paths": {
-  "@capabilities/*": ["src/ai-capabilities/*"]
+  "@capabilities/*": ["src/app-capabilities/*"]
 }
```

The `doctor` command will flag the legacy directory until the rename is complete:

```bash
npx ai-capabilities doctor
```

## Step 3: Generate and publish a public manifest

Starting with 0.4.0, the `.well-known/ai-capabilities.json` endpoint requires an explicit public manifest file at `output/ai-capabilities.public.json`. The runtime no longer falls back to the internal manifest implicitly.

Generate the public manifest:

```bash
npx ai-capabilities manifest public
```

This creates `output/ai-capabilities.public.json` containing only the capabilities marked with public visibility. Review the file before publishing to make sure no internal-only capabilities leak.

If you were previously relying on the implicit fallback (where `.well-known` served the full internal manifest), this is a breaking change. Without the public manifest file, the `.well-known` endpoint returns an empty response and logs a warning.

## Step 4: Adopt the `loadManifest` API

The new `loadManifest` helper provides predictable manifest loading with clear precedence rules for runtime URLs, explicit public manifest URLs, and local files. It replaces ad-hoc manifest loading patterns.

```ts
import { loadManifest, resolveManifestSources } from "ai-capabilities";

// Inspect which sources will be used
const plan = resolveManifestSources({
  runtimeUrl: "http://localhost:4000",
  publicManifestUrl: "http://localhost:4000/.well-known/ai-capabilities.json",
});

// Load with caching and source logging
const result = await loadManifest({
  runtimeUrl: "http://localhost:4000",
});
```

The helper distinguishes between public and internal manifests so they cannot be mixed accidentally. Runtime logging now reports which manifest type was loaded, from which source, and whether a cache or fallback was used.

## Step 5: Handle CLI preflight checks

All CLI commands that depend on project scaffolding now run a preflight check before executing. If required artifacts are missing:

- **Interactive shells**: the CLI offers to run `init` immediately.
- **CI / non-interactive mode**: the CLI exits with a non-zero code and a message listing the missing artifacts.

If your CI pipeline runs commands like `extract` or `doctor`, make sure `init` has been run first, or handle the non-zero exit code appropriately.

## Step 6: Explore new capabilities

After completing the migration, take advantage of the new features:

- **`npx ai-capabilities status`** shows every capability's lifecycle state (discovered, scaffolded, authored, registered, wired, executable) with next-step guidance.
- **Swagger 2.0 support** means `swagger.json` and `swagger.yaml` files are now extracted alongside OpenAPI 3.x specs.
- **Preflight diagnostics** in `doctor` now surface missing init steps, absent public manifests, and unsafe fallbacks.

## Quick checklist

- [ ] Updated `ai-capabilities` to 0.4.x
- [ ] Renamed `src/ai-capabilities` to `src/app-capabilities`
- [ ] Updated import paths and path aliases referencing the old directory
- [ ] Ran `npx ai-capabilities manifest public` to generate `output/ai-capabilities.public.json`
- [ ] Reviewed public manifest contents for accidental leaks
- [ ] Replaced ad-hoc manifest loading with `loadManifest` / `resolveManifestSources` where applicable
- [ ] Updated CI pipelines to account for preflight checks
- [ ] Ran `npx ai-capabilities doctor` to confirm a clean bill of health
