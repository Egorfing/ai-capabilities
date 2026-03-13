import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import type { AiCapabilitiesManifest, AiCapability } from "../../types/index.js";
import { buildBackendPrompt, buildFrontendPrompt, buildImprovementPrompt, buildAllowlistPrompt } from "../../prompt/templates.js";

export const promptHelp = `
Usage: ai-capabilities prompt --template <backend|frontend|improve|allowlist> --file <manifest.json> [--id <capabilityId>]

Examples:
  ai-capabilities prompt --template backend --file ./output/ai-capabilities.json --id hook.create-project-mutation
  ai-capabilities prompt --template frontend --file ./output/ai-capabilities.json --id navigation.open-project-page
  ai-capabilities prompt --template allowlist --file ./output/ai-capabilities.json
`.trim();

const TEMPLATE_NAMES = new Set(["backend", "frontend", "improve", "allowlist"]);

export async function runPromptCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(promptHelp);
    return;
  }

  const template = typeof args.flags.template === "string" ? args.flags.template : "backend";
  if (!TEMPLATE_NAMES.has(template)) {
    throw new Error(`Unknown template "${template}". Supported: backend, frontend, improve, allowlist.`);
  }

  const fileFlag = args.flags.file;
  if (typeof fileFlag !== "string") {
    throw new Error("--file <path> is required and must point to a manifest JSON (raw or canonical).");
  }
  const filePath = resolve(fileFlag);
  const manifest = loadManifest(filePath);

  if (template === "allowlist") {
    const prompt = buildAllowlistPrompt(manifest.capabilities.map(minimalCapabilityShape));
    console.log(prompt);
    return;
  }

  const idFlag = args.flags.id;
  if (typeof idFlag !== "string" || !idFlag.trim()) {
    throw new Error("--id <capabilityId> is required for backend/frontend/improve templates.");
  }
  const capability = manifest.capabilities.find((cap) => cap.id === idFlag);
  if (!capability) {
    const available = manifest.capabilities.map((cap) => cap.id).slice(0, 10).join(", ");
    throw new Error(`Capability ${idFlag} not found in ${filePath}. Available ids (first 10): ${available}`);
  }

  const minimal = minimalCapabilityShape(capability);

  let prompt: string;
  switch (template) {
    case "backend":
      prompt = buildBackendPrompt(minimal);
      break;
    case "frontend":
      prompt = buildFrontendPrompt(minimal);
      break;
    case "improve":
      prompt = buildImprovementPrompt(minimal);
      break;
    default:
      throw new Error(`Unsupported template: ${template}`);
  }

  console.log(prompt);
}

function loadManifest(filePath: string): AiCapabilitiesManifest {
  const raw = readFileSync(filePath, "utf-8");
  const json = JSON.parse(raw);
  if (Array.isArray(json.capabilities)) {
    // Looks like canonical manifest
    return {
      manifestVersion: json.manifestVersion ?? "1.0.0",
      generatedAt: json.generatedAt ?? new Date().toISOString(),
      app: json.app ?? { name: "App" },
      defaults: json.defaults ?? {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "none",
      },
      capabilities: json.capabilities,
    } satisfies AiCapabilitiesManifest;
  }
  if (Array.isArray(json?.manifest?.capabilities)) {
    return json.manifest as AiCapabilitiesManifest;
  }
  throw new Error(`File ${filePath} does not look like an ai-capabilities manifest.`);
}

function minimalCapabilityShape(capability: AiCapability): AiCapability {
  return {
    ...capability,
    inputSchema: capability.inputSchema ?? { type: "object" },
    outputSchema: capability.outputSchema ?? undefined,
    tags: capability.tags ?? [],
    policy: capability.policy ?? {},
  };
}
