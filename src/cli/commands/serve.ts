import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { ParsedArgs } from "../parse-args.js";
import { loadConfig } from "../../config/load-config.js";
import type { ResolvedConfig } from "../../config/types.js";
import type { AiCapabilitiesManifest } from "../../types/index.js";
import { CapabilityRuntime } from "../../runtime/index.js";
import { createBoundRegistry } from "../../binding/index.js";
import { startServer } from "../../server/index.js";
import type { ExecutionMode } from "../../runtime/runtime-types.js";

export const serveHelp = `
Usage: capability-engine serve [options]

Start the HTTP server for capabilities and execution.

Options:
  --host <host>        Host interface to bind (default: 127.0.0.1)
  --port <number>      Port to listen on (default: 3000)
  --manifest <path>    Path to canonical manifest (default: config.output.canonical)
  --config <path>      Path to ai-capabilities.config.json|ts (default: auto)
  --public             Run server in public mode (default: internal)
  --help               Show this help
`.trim();

export async function runServe(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(serveHelp);
    return;
  }

  const host = typeof args.flags.host === "string" ? args.flags.host : undefined;
  const port = parsePort(args.flags.port);
  const publicMode = Boolean(args.flags.public);
  const mode: ExecutionMode = publicMode ? "public" : "internal";
  const configPath = typeof args.flags.config === "string" ? args.flags.config : undefined;

  const config = await loadConfigSafe(configPath);
  const manifestPath = resolveManifestPath(args.flags.manifest, config);
  const canonicalManifest = readManifest(manifestPath);
  const publicManifest = resolvePublicManifest(config, canonicalManifest, publicMode);
  const tracesDir = config?.output.tracesDir ?? resolve("output/traces");

  const { registry } = createBoundRegistry({ manifest: canonicalManifest });
  const runtime = new CapabilityRuntime({ manifest: canonicalManifest, registry, mode });

  console.log(`[serve] manifest: ${manifestPath}`);
  console.log(`[serve] mode: ${mode}`);
  console.log(`[serve] traces: ${tracesDir}`);

  const { server, info } = await startServer(
    {
      manifest: canonicalManifest,
      publicManifest,
      runtime,
      tracesDir,
      logger: console,
    },
    {
      host,
      port,
      mode,
    },
  );

  const shutdown = async () => {
    console.log("[serve] shutting down...");
    await server.close().catch((err) => {
      console.error(`[serve] failed to stop: ${err instanceof Error ? err.message : String(err)}`);
    });
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`[serve] listening on http://${info.host}:${info.port}`);
}

function parsePort(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    console.error("[serve] --port requires a numeric value");
    process.exit(1);
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`[serve] invalid port: ${value}`);
    process.exit(1);
  }
  return port;
}

async function loadConfigSafe(configPath?: string): Promise<ResolvedConfig | undefined> {
  try {
    return await loadConfig({ configPath, cwd: process.cwd() });
  } catch (err) {
    console.warn(
      `[serve] failed to load config${configPath ? ` (${configPath})` : ""}: ${err instanceof Error ? err.message : String(err)}`,
    );
    if (configPath) {
      process.exit(1);
    }
    return undefined;
  }
}

function resolveManifestPath(flagValue: unknown, config?: ResolvedConfig): string {
  if (typeof flagValue === "string") {
    return resolve(flagValue);
  }
  if (config) {
    return config.output.canonical;
  }
  const fallback = resolve("output/ai-capabilities.json");
  return fallback;
}

function readManifest(filePath: string): AiCapabilitiesManifest {
  if (!existsSync(filePath)) {
    console.error(`[serve] manifest file not found at ${filePath}. Run \`npm run extract\` first.`);
    process.exit(1);
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as AiCapabilitiesManifest;
  } catch (err) {
    console.error(`[serve] failed to read manifest: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function resolvePublicManifest(
  config: ResolvedConfig | undefined,
  canonical: AiCapabilitiesManifest,
  publicMode: boolean,
): AiCapabilitiesManifest {
  const publicPath = config?.output.public;
  if (publicPath && existsSync(publicPath)) {
    try {
      const raw = readFileSync(publicPath, "utf-8");
      return JSON.parse(raw) as AiCapabilitiesManifest;
    } catch (err) {
      if (publicMode) {
        console.warn(`[serve] failed to read public manifest: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (publicMode) {
    console.warn("[serve] using filtered canonical manifest for public mode");
  }
  return {
    ...canonical,
    capabilities: canonical.capabilities.filter((cap) => cap.policy.visibility === "public"),
  };
}
