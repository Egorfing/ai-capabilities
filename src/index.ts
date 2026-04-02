// Capability Engine — main entry point
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const _pkg = _require("../package.json") as { version: string };
/** Library version — single source of truth is package.json */
export const VERSION: string = _pkg.version;

export {
  defineCapability,
  defineCapabilityFromExtracted,
  registerCapabilityDefinitions,
  capabilityDefinitionToRegistryEntry,
} from "./capability-definition/index.js";
export type {
  CapabilityDefinitionInput,
  DefinedCapability,
  CapabilityHelperContext,
  CapabilityRouterAdapter,
  CapabilityUIAdapter,
  CapabilityNotifyAdapter,
  CapabilityExecutor,
  CapabilityPolicyDefinition,
  ExtractedCapabilityDefinitionInput,
  CapabilityRegistryLike,
} from "./capability-definition/index.js";
export {
  CapabilityRegistry,
  CapabilityRuntime,
  evaluatePolicy,
  resolvePolicy,
  visibilityRule,
  permissionScopeRule,
  destructiveRule,
  confirmationRule,
  defaultPolicyRules,
} from "./runtime/index.js";
export type {
  CapabilityHandler,
  CapabilityHandlerContext,
  CapabilityRuntimeExecuteOptions,
  CapabilityRuntimeInterface,
  CapabilityRuntimeOptions,
  ExecutionMode,
  RuntimeError,
  RuntimeErrorCode,
  PolicyDecision,
  PolicyReason,
  PolicyReasonCode,
  PolicyRule,
  CapabilityExecutionContext,
  ResolvedPolicy,
  EvaluatePolicyOptions,
} from "./runtime/index.js";
export type {
  AiCapabilitiesManifest,
  AiCapability,
  CapabilityExecutionResult,
  CapabilityExecutionRequest,
} from "./types/index.js";
export {
  loadManifest,
  resolveManifestSources,
} from "./manifest/manifest-loader.js";
export type {
  ManifestLoaderOptions,
  ManifestLoadResult,
  ManifestSourcePlan,
  ManifestLoaderLogger,
  ManifestVisibility,
} from "./manifest/manifest-loader.js";
export { buildOpenAITools } from "./adapters/model-tools/openai.js";
export type { OpenAITool } from "./adapters/model-tools/openai.js";
export { buildAnthropicTools } from "./adapters/model-tools/anthropic.js";
export type { AnthropicTool } from "./adapters/model-tools/anthropic.js";
export { buildMcpTools } from "./adapters/model-tools/mcp.js";
export type { McpTool } from "./adapters/model-tools/mcp.js";
export { buildModelToolDefinitions } from "./adapters/model-tools/base.js";
export type { BuildToolOptions } from "./adapters/model-tools/base.js";
