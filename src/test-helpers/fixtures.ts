import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "../..");
const FIXTURES_ROOT = resolve(REPO_ROOT, "fixtures");
const GOLDEN_ROOT = resolve(FIXTURES_ROOT, "golden");

export function projectRoot(...segments: string[]): string {
  return resolve(REPO_ROOT, ...segments);
}

export function fixturePath(...segments: string[]): string {
  return resolve(FIXTURES_ROOT, ...segments);
}

export function goldenPath(...segments: string[]): string {
  return resolve(GOLDEN_ROOT, ...segments);
}

export function readGoldenJson<T = unknown>(...segments: string[]): T {
  const file = goldenPath(...segments);
  const contents = readFileSync(file, "utf-8");
  return JSON.parse(contents) as T;
}

export const DEMO_APP_PATH = fixturePath("demo-app");
export const DEMO_CONFIG_PATH = fixturePath("config", "basic", "ai-capabilities.config.json");

export function relativeToRepo(target: string): string {
  return relative(REPO_ROOT, target);
}
