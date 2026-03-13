import type {
  CapabilityKind,
  ConfirmationPolicy,
  JsonSchema,
  RiskLevel,
  Visibility,
} from "../types/index.js";
import type { ExecutionMode } from "../runtime/index.js";

export interface CapabilityPolicyDefinition {
  visibility?: Visibility;
  riskLevel?: RiskLevel;
  confirmationPolicy?: ConfirmationPolicy;
}

export interface CapabilityRouterAdapter {
  navigate: (path: string, options?: Record<string, unknown>) => Promise<void> | void;
}

export interface CapabilityUIAdapter {
  openModal?: (id: string, payload?: Record<string, unknown>) => Promise<void> | void;
  openPanel?: (id: string, payload?: Record<string, unknown>) => Promise<void> | void;
  startFlow?: (id: string, payload?: Record<string, unknown>) => Promise<void> | void;
  focusEntity?: (entityId: string) => Promise<void> | void;
}

export interface CapabilityNotifyAdapter {
  info: (message: string) => void;
  success?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

export interface CapabilityHelperContext {
  mode?: ExecutionMode;
  caller?: string;
  router?: CapabilityRouterAdapter;
  ui?: CapabilityUIAdapter;
  notify?: CapabilityNotifyAdapter;
  metadata?: Record<string, unknown>;
}

export type CapabilityExecutor<Input, Output> = (
  input: Input,
  context?: CapabilityHelperContext,
) => Promise<Output> | Output;

export interface CapabilityDefinitionInput<Input = Record<string, unknown>, Output = unknown> {
  id: string;
  kind?: CapabilityKind;
  displayTitle: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  tags?: string[];
  aliases?: string[];
  exampleIntents?: string[];
  policy?: CapabilityPolicyDefinition;
  metadata?: Record<string, unknown>;
  execute: CapabilityExecutor<Input, Output>;
}

export interface DefinedCapability<Input = Record<string, unknown>, Output = unknown>
  extends CapabilityDefinitionInput<Input, Output> {
  readonly source: "manual";
}
