import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import type { AiCapabilitiesManifest } from "../../types/index.js";
import { buildPublicManifestSnapshot } from "../../manifest/public-manifest.js";

export const manifestPublicHelp = `
Usage: ai-capabilities manifest public [options]

Generate a sanitized public manifest from the canonical manifest file.

Options:
  --input <path>   Path to canonical manifest (default: ./output/ai-capabilities.json)
  --output <path>  Path to write public manifest (default: ./output/ai-capabilities.public.json)
  --help           Show this help
`.trim();

export async function runManifestPublicCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(manifestPublicHelp);
    return;
  }

  const inputPath = resolve(
    typeof args.flags.input === "string" ? args.flags.input : "output/ai-capabilities.json",
  );
  const outputPath = resolve(
    typeof args.flags.output === "string" ? args.flags.output : "output/ai-capabilities.public.json",
  );

  const manifest = readManifest(inputPath);
  const publicManifest = buildPublicManifestSnapshot(manifest);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(publicManifest, null, 2) + "\n", "utf-8");

  const excluded = manifest.capabilities.length - publicManifest.capabilities.length;
  console.log(`[manifest public] input: ${inputPath}`);
  console.log(`[manifest public] output: ${outputPath}`);
  console.log(
    `[manifest public] exported ${publicManifest.capabilities.length} capabilities (skipped ${Math.max(
      excluded,
      0,
    )} non-public entries)`,
  );
}

function readManifest(filePath: string): AiCapabilitiesManifest {
  if (!existsSync(filePath)) {
    throw new Error(`Canonical manifest not found at ${filePath}. Run \`npx ai-capabilities extract\` first.`);
  }
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as AiCapabilitiesManifest;
}
