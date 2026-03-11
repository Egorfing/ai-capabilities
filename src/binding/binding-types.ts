import type { CapabilityHandler } from "../runtime/runtime-types.js";

export type BindingMode = "manual" | "http" | "frontend-bridge";

interface BaseBinding {
  capabilityId: string;
  mode: BindingMode;
}

export interface ManualCapabilityBinding extends BaseBinding {
  mode: "manual";
  handler: CapabilityHandler;
}

export interface HttpCapabilityBinding extends BaseBinding {
  mode: "http";
  endpoint: {
    method: string;
    path: string;
    baseUrl?: string;
    headers?: Record<string, string>;
  };
}

export interface FrontendBridgeBinding extends BaseBinding {
  mode: "frontend-bridge";
  bridgeAction: string;
}

export type CapabilityBinding =
  | ManualCapabilityBinding
  | HttpCapabilityBinding
  | FrontendBridgeBinding;

export type ResolvedCapabilityBinding = CapabilityBinding & {
  source: "explicit" | "manifest";
};

export interface BindingResolutionSuccess {
  ok: true;
  binding: ResolvedCapabilityBinding;
}

export interface BindingResolutionFailure {
  ok: false;
  error: BindingError;
}

export type BindingResolution = BindingResolutionSuccess | BindingResolutionFailure;

export interface BindingError {
  code: BindingErrorCode;
  message: string;
  details?: unknown;
}

export type BindingErrorCode =
  | "CAPABILITY_NOT_FOUND"
  | "BINDING_NOT_FOUND"
  | "UNSUPPORTED_BINDING_MODE"
  | "INVALID_BINDING";
