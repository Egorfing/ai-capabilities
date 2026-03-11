// ---------------------------------------------------------------------------
// Minimal CLI argument parser (zero deps)
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  /** The sub-command, e.g. "extract", "validate", "trace list" */
  command: string;
  /** Named flags: --project ./foo → { project: "./foo" } */
  flags: Record<string, string | boolean>;
  /** Positional arguments after flags */
  positional: string[];
}

/**
 * Parse process.argv (skip node + script).
 * Supports: --flag value, --flag=value, --bool-flag (true), positional args.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = "";

  let i = 0;

  // First non-flag tokens form the command (e.g. "trace list")
  while (i < args.length && !args[i].startsWith("-")) {
    if (!command) {
      command = args[i];
    } else {
      // second word becomes part of the command (sub-command)
      command += ` ${args[i]}`;
    }
    i++;
  }

  // Parse remaining flags and positional args
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags[arg.slice(1)] = next;
        i++;
      } else {
        flags[arg.slice(1)] = true;
      }
    } else {
      positional.push(arg);
    }

    i++;
  }

  return { command, flags, positional };
}
