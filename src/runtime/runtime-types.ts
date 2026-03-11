import type { CapabilityExecutionRequest, CapabilityExecutionResult } from "../types/index.js";

export type ExecutionMode = "internal" | "public";

export type CapabilityHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>;

export interface CapabilityRuntimeExecuteOptions {
  mode?: ExecutionMode;
  /** Permission scopes granted to the current caller. */
  permissionScopes?: string[];
  /** Whether destructive / high-risk operations are allowed. */
  allowDestructive?: boolean;
}

export interface CapabilityRuntimeInterface {
  execute(
    request: CapabilityExecutionRequest,
    options?: CapabilityRuntimeExecuteOptions,
  ): Promise<CapabilityExecutionResult>;
}
