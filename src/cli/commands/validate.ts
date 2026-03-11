import { readFileSync } from "node:fs";
import type { ParsedArgs } from "../parse-args.js";
import {
  validateRawManifest,
  validateEnrichedManifest,
} from "../../utils/validate-manifest.js";

export const validateHelp = `
Usage: capability-engine validate [options]

Validate a capability manifest file.

Options:
  --file <path>      Path to manifest JSON (required)
  --enriched         Validate as enriched manifest (default: raw)
  --help             Show this help
`.trim();

export function runValidate(args: ParsedArgs): void {
  if (args.flags.help) {
    console.log(validateHelp);
    return;
  }

  const file = args.flags.file;
  if (!file || typeof file !== "string") {
    console.error("Error: --file <path> is required\n");
    console.error(validateHelp);
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: cannot read file "${file}": ${msg}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    console.error(`Error: file "${file}" is not valid JSON.`);
    process.exit(1);
  }

  const result = args.flags.enriched
    ? validateEnrichedManifest(data)
    : validateRawManifest(data);

  if (result.valid) {
    const kind = args.flags.enriched ? "enriched" : "raw";
    console.log(`✓ Valid ${kind} manifest (${file})`);
  } else {
    console.error(`✗ Invalid manifest (${file}):\n`);
    for (const err of result.errors) {
      console.error(`  ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }
}
