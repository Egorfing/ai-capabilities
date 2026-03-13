import { promises as fs } from "node:fs";
import path from "node:path";
import type { ParsedArgs } from "../parse-args.js";

const AI_LIBRARY_PATTERNS: RegExp[] = [
  /^openai$/i,
  /^@?ai-sdk/i,
  /^ai$/i,
  /^anthropic$/i,
  /^@anthropic\//i,
  /^langchain/i,
  /^llamaindex/i,
  /^@vercel\/ai$/i,
  /^vercel-ai$/i,
  /^replicate$/i,
  /^together/i,
  /^@azure\/openai$/i,
  /^groq$/i,
  /^@google\/generativelanguage$/i,
];

const CHAT_FILE_REGEX = /(AiChat|ChatBox|ChatPanel|AgentChat|Assistant|Chat)\.(tsx|jsx)$/i;
const AGENT_FILE_REGEX = /(agent|assistant|tool|runtime)/i;
const SERVER_PATH_REGEX = /(api|server|functions|routes).*(chat|assistant|ai|agent)/i;

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".git",
  ".next",
  "coverage",
  "tmp",
  "output",
]);

export interface LlmDetectionResult {
  libraries: string[];
  chatComponents: string[];
  agentFiles: string[];
  serverEndpoints: string[];
  recommendation: string;
}

const detectHelp = `
Usage: capability-engine detect-llm [options]

Detect existing AI/LLM stacks in the current project.

Options:
  --project <path>   Root directory to inspect (default: cwd)
  --json             Output JSON instead of text
  --help             Show this help
`.trim();

export async function runDetectLlmCommand(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(detectHelp);
    return;
  }

  const projectPath = resolveProjectPath(args.flags.project);
  const result = await detectLlmStack(projectPath);

  if (isJsonRequested(args.flags.json)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatDetectionReport(result, projectPath));
}

export async function detectLlmStack(projectPath: string): Promise<LlmDetectionResult> {
  const pkgPath = path.join(projectPath, "package.json");
  const libraries = await detectLibraries(pkgPath);

  const files = await collectProjectFiles(projectPath, 2000);
  const chatComponents = matchFiles(files, CHAT_FILE_REGEX, projectPath);
  const agentFiles = matchFiles(files, AGENT_FILE_REGEX, projectPath);
  const serverEndpoints = files
    .filter((file) => SERVER_PATH_REGEX.test(file.relativePath))
    .map((file) => file.relativePath);

  const recommendation = buildRecommendation({ libraries, chatComponents, agentFiles, serverEndpoints });

  return { libraries, chatComponents, agentFiles, serverEndpoints, recommendation };
}

function resolveProjectPath(flag: unknown): string {
  if (typeof flag === "string") {
    return path.resolve(process.cwd(), flag);
  }
  return process.cwd();
}

async function detectLibraries(pkgPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.keys(deps).filter((dep) => AI_LIBRARY_PATTERNS.some((pattern) => pattern.test(dep)));
  } catch {
    return [];
  }
}

interface ProjectFile {
  absolutePath: string;
  relativePath: string;
  name: string;
}

async function collectProjectFiles(root: string, limit: number): Promise<ProjectFile[]> {
  const results: ProjectFile[] = [];
  const queue: string[] = [root];

  while (queue.length > 0) {
    const current = queue.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      const absPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(root, absPath);
        results.push({ absolutePath: absPath, relativePath, name: entry.name });
        if (results.length >= limit) {
          return results;
        }
      }
    }
  }

  return results;
}

function matchFiles(files: ProjectFile[], regex: RegExp, projectPath: string): string[] {
  return files
    .filter((file) => regex.test(file.name))
    .map((file) => file.relativePath)
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();
}

function buildRecommendation(result: Pick<LlmDetectionResult, "libraries" | "chatComponents" | "agentFiles" | "serverEndpoints">): string {
  if (result.chatComponents.length > 0) {
    return "extend_existing_chat";
  }
  if (result.serverEndpoints.length > 0) {
    return "extend_existing_server";
  }
  if (result.agentFiles.length > 0 || result.libraries.length > 0) {
    return "reuse_detected_libraries";
  }
  return "no_llm_detected";
}

export function formatDetectionReport(result: LlmDetectionResult, projectPath: string): string {
  const sections = [
    formatListSection("Libraries", result.libraries),
    formatListSection("Chat UI", result.chatComponents),
    formatListSection("Agent logic", result.agentFiles),
    formatListSection("Server endpoints", result.serverEndpoints),
  ];

  return [
    "AI Stack Detection",
    "------------------",
    ...sections,
    "Recommendation:",
    `  ${recommendationLabel(result.recommendation)}`,
    "",
    "(Heuristic results — verify before making decisions.)",
  ].join("\n");
}

function formatListSection(title: string, items: string[]): string {
  if (items.length === 0) {
    return `${title}:\n  ✘ none detected`;
  }
  const lines = items.map((item) => `  ✔ ${item}`);
  return `${title}:\n${lines.join("\n")}`;
}

function recommendationLabel(rec: string): string {
  switch (rec) {
    case "extend_existing_chat":
      return "Extend the existing in-app chat flow with AI Capabilities.";
    case "extend_existing_server":
      return "Reuse the existing server/runtime endpoints for AI Capabilities.";
    case "reuse_detected_libraries":
      return "Reuse the detected AI libraries when wiring AI Capabilities.";
    default:
      return "No AI stack detected. Follow the happy path to add one.";
  }
}

function isJsonRequested(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
    return true;
  }
  return Boolean(value);
}
