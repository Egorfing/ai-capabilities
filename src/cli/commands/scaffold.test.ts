import { describe, it, expect, afterEach, vi } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import readline from "node:readline";
import type { ParsedArgs } from "../parse-args.js";
import { runScaffoldCommand } from "./scaffold.js";
import type { AiCapabilitiesManifest, AiCapability } from "../../types/index.js";

const TMP_PREFIX = "ai-capabilities-scaffold-";

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
      kind: cap.kind ?? "mutation",
      displayTitle: cap.displayTitle ?? "Example",
      description: cap.description ?? "Example description",
      userDescription: cap.userDescription ?? "Example description",
      inputSchema: cap.inputSchema ?? { type: "object", properties: {} },
      policy:
        cap.policy ?? ({
          visibility: "internal",
          riskLevel: "medium",
          confirmationPolicy: "none",
        } as AiCapability["policy"]),
      tags: cap.tags ?? [],
      aliases: cap.aliases ?? [],
      exampleIntents: cap.exampleIntents ?? [],
      sources: cap.sources ?? [{ type: "manual", location: cap.id ?? `hook.example-${index}` }],
    })),
  };
}

describe("scaffold CLI command", () => {
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

  it("generates a scaffold file with the extracted linkage", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      {
        id: "hook.create-project-mutation",
        displayTitle: "Create Project",
        description: "Create a project",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
        aliases: ["create project"],
        exampleIntents: ["Create a project"],
      },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = {
      command: "scaffold",
      flags: {
        id: "hook.create-project-mutation",
        manifest: manifestPath,
        dir: path.join(workspace.dir, "src/ai-capabilities/capabilities"),
      },
      positional: [],
    };

    await runScaffoldCommand(args);

    const generatedPath = path.join(
      workspace.dir,
      "src/ai-capabilities/capabilities",
      "createProjectCapability.ts",
    );
    const content = await readFile(generatedPath, "utf-8");
    expect(content).toContain('sourceId: "hook.create-project-mutation"');
    expect(content).toContain("defineCapabilityFromExtracted");
    expect(content).toContain("aliases:");
    expect(content).toContain("exampleIntents:");
    expect(logSpy).toHaveBeenCalled();
  });

  it("applies destructive safety defaults", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      {
        id: "hook.delete-user-mutation",
        description: "Delete a user",
        policy: undefined,
      },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const args: ParsedArgs = {
      command: "scaffold",
      flags: {
        id: "hook.delete-user-mutation",
        manifest: manifestPath,
        dir: path.join(workspace.dir, "caps"),
      },
      positional: [],
    };

    await runScaffoldCommand(args);

    const generated = await readFile(path.join(workspace.dir, "caps", "deleteUserCapability.ts"), "utf-8");
    expect(generated).toContain('riskLevel: "high"');
    expect(generated).toContain('confirmationPolicy: "always"');
  });

  it("throws when capability id is unknown", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(createManifest([]), null, 2));

    const args: ParsedArgs = {
      command: "scaffold",
      flags: {
        id: "hook.missing",
        manifest: manifestPath,
        dir: path.join(workspace.dir, "caps"),
      },
      positional: [],
    };

    await expect(runScaffoldCommand(args)).rejects.toThrow(/not found/);
  });

  it("lists capabilities with --list flag", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      { id: "hook.create-project-mutation" },
      { id: "hook.projects-query" },
      { id: "hook.delete-project-mutation" },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = {
      command: "scaffold",
      flags: {
        list: true,
        manifest: manifestPath,
      },
      positional: [],
    };

    await runScaffoldCommand(args);

    expect(logSpy).toHaveBeenCalledWith("Extracted capabilities:\n");
    expect(logSpy).toHaveBeenCalledWith("1. hook.create-project-mutation");
    expect(logSpy).toHaveBeenCalledWith("3. hook.delete-project-mutation");
  });

  it("prompts for selection when no id and terminal is interactive", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());
    const manifestPath = path.join(workspace.dir, "manifest.json");
    const manifest = createManifest([
      { id: "hook.create-project-mutation" },
      { id: "hook.projects-query" },
    ]);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean };
    const stdout = process.stdout as NodeJS.WriteStream & { isTTY?: boolean };
    const previousStdinTTY = stdin.isTTY;
    const previousStdoutTTY = stdout.isTTY;
    stdin.isTTY = true;
    stdout.isTTY = true;
    disposers.push(async () => {
      stdin.isTTY = previousStdinTTY;
      stdout.isTTY = previousStdoutTTY;
    });

    const fakeInterface = {
      question: (_prompt: string, callback: (answer: string) => void) => {
        callback("2");
        return undefined;
      },
      close: vi.fn(),
    } as unknown as readline.Interface;

    const rlSpy = vi.spyOn(readline, "createInterface").mockReturnValue(fakeInterface);
    disposers.push(async () => rlSpy.mockRestore());

    const args: ParsedArgs = {
      command: "scaffold",
      flags: {
        manifest: manifestPath,
        dir: path.join(workspace.dir, "src/ai-capabilities/capabilities"),
      },
      positional: [],
    };

    await runScaffoldCommand(args);

    const generatedPath = path.join(
      workspace.dir,
      "src/ai-capabilities/capabilities",
      "projectsCapability.ts",
    );
    const generated = await readFile(generatedPath, "utf-8");
    expect(generated).toContain('sourceId: "hook.projects-query"');
    expect(rlSpy).toHaveBeenCalled();
  });

  it("prints guidance when --list is used without a manifest", async () => {
    const workspace = await setupWorkspace();
    disposers.push(() => workspace.cleanup());

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const previousExitCode = process.exitCode;
    disposers.push(async () => {
      process.exitCode = previousExitCode;
    });

    const args: ParsedArgs = {
      command: "scaffold",
      flags: {
        list: true,
        manifest: path.join(workspace.dir, "missing.json"),
      },
      positional: [],
    };

    await runScaffoldCommand(args);

    expect(logSpy).toHaveBeenCalledWith("No manifest found.");
    expect(logSpy).toHaveBeenCalledWith("npx ai-capabilities extract");
    expect(process.exitCode).toBe(1);
  });
});
