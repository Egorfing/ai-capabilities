import { resolve } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { loadConfig } from "../../config/load-config.js";
import {
  readTraceDir,
  filterTraceEvents,
  listTraceIds,
} from "../../trace/index.js";
import type { TraceFilter, TraceStage, TraceLevel } from "../../trace/index.js";

export const traceHelp = `
Usage: capability-engine trace list [options]

List and filter execution traces.

Options:
  --trace-id <id>          Filter by trace ID
  --stage <stage>          Filter by stage (extract, enrich, adapter, runtime, policy)
  --level <level>          Filter by level (info, warning, error)
  --capability-id <id>     Filter by capability ID
  --dir <path>             Override traces directory
  --list-ids               Just list trace IDs, no events
  --limit <number>         Max events to show (default: 100)
  --help                   Show this help
`.trim();

const VALID_STAGES: TraceStage[] = ["extract", "enrich", "adapter", "runtime", "policy"];
const VALID_LEVELS: TraceLevel[] = ["info", "warning", "error"];

export async function runTrace(args: ParsedArgs): Promise<void> {
  if (args.flags.help) {
    console.log(traceHelp);
    return;
  }

  // Resolve traces directory
  let tracesDir: string;
  if (typeof args.flags.dir === "string") {
    tracesDir = resolve(args.flags.dir);
  } else {
    try {
      const config = await loadConfig({
        configPath: typeof args.flags.config === "string" ? args.flags.config : undefined,
        cwd: process.cwd(),
      });
      tracesDir = config.output.tracesDir;
    } catch {
      tracesDir = resolve("output/traces");
    }
  }

  // List IDs mode
  if (args.flags["list-ids"]) {
    const ids = listTraceIds(tracesDir);
    if (ids.length === 0) {
      console.log("No traces found.");
    } else {
      console.log(`Found ${ids.length} trace(s):`);
      for (const id of ids) {
        console.log(`  ${id}`);
      }
    }
    return;
  }

  // Build filter
  const filter: TraceFilter = {};
  if (typeof args.flags["trace-id"] === "string") {
    filter.traceId = args.flags["trace-id"];
  }
  if (typeof args.flags.stage === "string") {
    const stage = args.flags.stage as TraceStage;
    if (!VALID_STAGES.includes(stage)) {
      console.error(`Invalid stage: "${stage}". Valid: ${VALID_STAGES.join(", ")}`);
      process.exit(1);
    }
    filter.stage = stage;
  }
  if (typeof args.flags.level === "string") {
    const level = args.flags.level as TraceLevel;
    if (!VALID_LEVELS.includes(level)) {
      console.error(`Invalid level: "${level}". Valid: ${VALID_LEVELS.join(", ")}`);
      process.exit(1);
    }
    filter.level = level;
  }
  if (typeof args.flags["capability-id"] === "string") {
    filter.capabilityId = args.flags["capability-id"];
  }

  const limit = typeof args.flags.limit === "string" ? Number(args.flags.limit) : 100;

  // Read and filter
  const allEvents = readTraceDir(tracesDir);
  const filtered = filterTraceEvents(allEvents, filter);
  const shown = filtered.slice(0, limit);

  if (shown.length === 0) {
    console.log("No trace events found.");
    return;
  }

  console.log(`Showing ${shown.length} of ${filtered.length} event(s) from ${tracesDir}\n`);

  for (const event of shown) {
    const ts = event.timestamp.slice(11, 23); // HH:MM:SS.mmm
    const level = event.level.toUpperCase().padEnd(7);
    const stage = event.stage.padEnd(7);
    const capId = event.capabilityId ? ` [${event.capabilityId}]` : "";
    console.log(`${ts} ${level} ${stage} ${event.eventType}${capId}`);
    console.log(`  ${event.message}`);
    if (event.data && Object.keys(event.data).length > 0) {
      console.log(`  ${JSON.stringify(event.data)}`);
    }
  }

  if (filtered.length > shown.length) {
    console.log(`\n... ${filtered.length - shown.length} more events (use --limit to show more)`);
  }
}
