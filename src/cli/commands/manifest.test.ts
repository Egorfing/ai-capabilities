import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { runManifestPublicCommand } from "./manifest.js";
import type { AiCapabilitiesManifest } from "../../types/index.js";

describe("manifest public command", () => {
  it("writes sanitized public manifest", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ai-cap-manifest-"));
    const canonicalPath = join(cwd, "canonical.json");
    const publicPath = join(cwd, "public.json");
    const manifest: AiCapabilitiesManifest = {
      manifestVersion: "1.0.0",
      generatedAt: "2026-03-14T00:00:00.000Z",
      app: { name: "Test App" },
      defaults: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
      capabilities: [
        {
          id: "public.capability",
          kind: "read",
          displayTitle: "Public",
          description: "Public cap",
          inputSchema: { type: "object" },
          policy: { visibility: "public", riskLevel: "low", confirmationPolicy: "none" },
          execution: { mode: "http", handlerRef: "publicHandler" },
          sources: [{ type: "openapi" }],
        },
        {
          id: "internal.capability",
          kind: "mutation",
          displayTitle: "Internal",
          description: "Internal cap",
          inputSchema: { type: "object" },
          policy: { visibility: "internal", riskLevel: "high", confirmationPolicy: "always" },
          sources: [{ type: "openapi" }],
        },
      ],
    };
    writeFileSync(canonicalPath, JSON.stringify(manifest, null, 2));

    const args: ParsedArgs = {
      command: "manifest public",
      flags: { input: canonicalPath, output: publicPath },
      positional: [],
    };
    await runManifestPublicCommand(args);

    const output = JSON.parse(readFileSync(publicPath, "utf-8")) as AiCapabilitiesManifest;
    expect(output.capabilities).toHaveLength(1);
    expect(output.capabilities[0]?.id).toBe("public.capability");
    expect((output.capabilities[0]?.execution as any)?.handlerRef).toBeUndefined();
  });
});
