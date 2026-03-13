import type {
  CapabilityExecutionRequest,
  CapabilityExecutionResult,
  AiCapabilitiesManifest,
} from "../types/index.js";

export type ExecutionMode = "internal" | "public";

export type CapabilityHandlerContext = Record<string, unknown> | undefined;

export type CapabilityHandler = (
  input: Record<string, unknown>,
  context?: CapabilityHandlerContext,
) => unknown | Promise<unknown>;

export interface CapabilityRuntimeExecuteOptions {
  mode?: ExecutionMode;
  /** Permission scopes granted to the current caller. */
  permissionScopes?: string[];
  /** Whether destructive / high-risk operations are allowed. */
  allowDestructive?: boolean;
  /** Optional context passed through to the registered handler (e.g. router/ui adapters). */
  handlerContext?: CapabilityHandlerContext;
}

export interface CapabilityRuntimeInterface {
  execute(
    request: CapabilityExecutionRequest,
    options?: CapabilityRuntimeExecuteOptions,
  ): Promise<CapabilityExecutionResult>;
  getManifest(): AiCapabilitiesManifest;
}
