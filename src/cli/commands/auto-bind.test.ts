import { describe, it, expect, afterEach, vi } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile, readFile, access } from "node:fs/promises";
import type { ParsedArgs } from "../parse-args.js";
import { runAutoBindCommand } from "./auto-bind.js";
import type { AiCapabilitiesManifest, AiCapability } from "../../types/index.js";

const TMP_PREFIX = "ai-capabilities-auto-bind-";

async function setupWorkspace() {
  const dir = await mkdtemp(path.join(tmpdir(), TMP_PREFIX));
  const previousCwd = process.cwd();
  process.chdir(dir);
  return {
    dir,
    previousCwd,
    async cleanup() {
      process.chdir(previousCwd);
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function createManifest(capabilities: Partial<AiCapability>[]): AiCapabilitiesManifest {
  return {
    manifestVersion: "test",
    generatedAt: new Date().toISOString(),
    app: { name: "Test App" },
    defaults: {
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    capabilities: capabilities.map((cap, index) => ({
      id: cap.id ?? `hook.example-${index}`,
      kind: cap.kind ?? "read",
      displayTitle: cap.displayTitle ?? "Example",
      description: cap.description ?? "Example description",
      userDescription: cap.userDescription ?? "Example description",
      inputSchema: cap.inputSchema ?? { type: "object", properties: {} },
      policy:
        cap.policy ?? ({
          visibility: "internal",
          riskLevel: "low",
          confirmationPolicy: "none",
        } as AiCapability["policy"]),
      tags: cap.tags ?? [],
      aliases: cap.aliases ?? [],
      exampleIntents: cap.exampleIntents ?? [],
      sources: cap.sources ?? [{ type: "manual", location: cap.id ?? `hook.example-${index}` }],
      execution: cap.execution,
      metadata: cap.metadata,
    })),
  };
}

describe("auto-bind CLI command", () => {
  const disposers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (disposers.length) {
      const dispose = disposers.pop();
      if (dispose) {
        await dispose();
      }
    }
    vi.restoreAllMocks();
  });

  it("auto binds safe read capabilities into files", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      {
        id: "hook.projects-query",
        kind: "read",
        displayTitle: "List projects",
        policy: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
      },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const args: ParsedArgs = {
      command: "auto-bind",
      flags: {
        manifest: manifestPath,
        dir: path.join(workspace.dir, "src/ai-capabilities/auto"),
      },
      positional: [],
    };

    await runAutoBindCommand(args);

    const generatedPath = path.join(workspace.dir, "src/ai-capabilities/auto", "projectsCapability.ts");
    const content = await readFile(generatedPath, "utf-8");
    expect(content).toContain('defineCapabilityFromExtracted');
    expect(content).toContain('sourceId: "hook.projects-query"');
    expect(content).toContain('id: "projects.list"');
  });

  it("skips destructive capabilities and prints reasons", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      {
        id: "hook.delete-project-mutation",
        kind: "mutation",
        displayTitle: "Delete project",
        policy: { visibility: "internal", riskLevel: "high", confirmationPolicy: "always" },
      },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = {
      command: "auto-bind",
      flags: {
        manifest: manifestPath,
        dir: path.join(workspace.dir, "src/ai-capabilities/auto"),
      },
      positional: [],
    };

    await runAutoBindCommand(args);

    expect(logSpy).toHaveBeenCalledWith("[auto-bind] skipped dangerous:");
    const generatedPath = path.join(workspace.dir, "src/ai-capabilities/auto", "deleteProjectCapability.ts");
    await expect(access(generatedPath)).rejects.toThrow();
  });

  it("supports dry-run mode without writing files", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      {
        id: "hook.current-user-query",
        kind: "read",
        displayTitle: "Current user",
        policy: { visibility: "internal", riskLevel: "low", confirmationPolicy: "none" },
      },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = {
      command: "auto-bind",
      flags: {
        manifest: manifestPath,
        dir: path.join(workspace.dir, "src/ai-capabilities/auto"),
        "dry-run": true,
      },
      positional: [],
    };

    await runAutoBindCommand(args);

    expect(logSpy).toHaveBeenCalledWith("[auto-bind] dry-run: no files written");
    const generatedPath = path.join(workspace.dir, "src/ai-capabilities/auto", "currentUserCapability.ts");
    await expect(access(generatedPath)).rejects.toThrow();
  });

  it("auto binds create/update mutations that meet criteria", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      {
        id: "hook.create-project-mutation",
        kind: "mutation",
        displayTitle: "Create project",
        policy: { visibility: "internal", riskLevel: "medium", confirmationPolicy: "once" },
      },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const args: ParsedArgs = {
      command: "auto-bind",
      flags: {
        manifest: manifestPath,
        dir: path.join(workspace.dir, "src/ai-capabilities/auto"),
      },
      positional: [],
    };

    await runAutoBindCommand(args);

    const generatedPath = path.join(workspace.dir, "src/ai-capabilities/auto", "createProjectCapability.ts");
    const content = await readFile(generatedPath, "utf-8");
    expect(content).toContain('sourceId: "hook.create-project-mutation"');
    expect(content).toContain("TODO: implement");
  });
});
