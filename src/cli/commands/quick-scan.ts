import type { ParsedArgs } from "../parse-args.js";
import { runDoctor } from "../../doctor/index.js";
import { runInspectPipeline, buildInspectSummary } from "../../inspect/index.js";
import { executeExtractCommand } from "./extract.js";
import { detectLlmStack } from "./detect-llm.js";
import { analyzeAutoBindCandidates } from "../../auto-bind/auto-bind-planner.js";

export async function runQuickScanCommand(args: ParsedArgs): Promise<void> {
  const projectFlag = typeof args.flags.project === "string" ? args.flags.project : undefined;
  const configFlag = typeof args.flags.config === "string" ? args.flags.config : undefined;

  const runOptions = {
    projectPath: projectFlag,
    configPath: configFlag,
    cwd: process.cwd(),
  };

  const doctorReport = await runDoctor(runOptions);
  const inspectLoad = await runInspectPipeline(runOptions);
  const inspectSummary = buildInspectSummary(inspectLoad, {});

  await executeExtractCommand({
    ...runOptions,
    logger: args.flags.verbose ? (message) => console.log(message) : undefined,
  });

  const autoPlan = analyzeAutoBindCandidates(inspectLoad.manifest);
  const llmResult = await detectLlmStack(inspectLoad.projectPath);
  const llmDetected =
    llmResult.libraries.length > 0 ||
    llmResult.chatComponents.length > 0 ||
    llmResult.agentFiles.length > 0 ||
    llmResult.serverEndpoints.length > 0;

  const metrics = inspectSummary.metrics;
  const readCount = metrics.byKind.read ?? 0;
  const mutationCount = metrics.byKind.mutation ?? 0;
  const navigationCount = metrics.byKind.navigation ?? 0;
  const otherKinds =
    metrics.totalAll - (readCount + mutationCount + navigationCount);

  const lines = [
    "AI Capabilities quick scan",
    "--------------------------",
    `Project: ${inspectLoad.projectPath}`,
    `Doctor status: ${doctorReport.status.toUpperCase()}`,
    "",
    `Capabilities discovered: ${metrics.totalAll}`,
    `  Reads: ${readCount}`,
    `  Mutations: ${mutationCount}`,
    `  Navigation: ${navigationCount}`,
    `  Other: ${Math.max(otherKinds, 0)}`,
    "",
    `Safe auto-bind candidates (dry-run): ${autoPlan.auto.length}`,
    `High-risk capabilities: ${metrics.highRisk}`,
    `Existing AI stack detected: ${llmDetected ? `yes — ${recommendationLabel(llmResult.recommendation)}` : "no"}`,
    "",
    "Next steps:",
    "  1. npx ai-capabilities auto-bind",
    "  2. npx ai-capabilities scaffold --id <capability>",
    "  3. npx ai-capabilities serve",
  ];

  console.log(lines.join("\n"));
}

function recommendationLabel(code: string): string {
  switch (code) {
    case "extend_existing_chat":
      return "extend existing chat flow";
    case "extend_existing_server":
      return "reuse existing server endpoints";
    case "reuse_detected_libraries":
      return "reuse detected AI libraries";
    default:
      return "no stack detected";
  }
}
