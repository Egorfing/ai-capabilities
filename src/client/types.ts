import type { WellKnownCapability, WellKnownResponse } from "../well-known/index.js";
import type { CapabilityExecutionResult } from "../types/index.js";
import type { ExecutionMode } from "../runtime/runtime-types.js";

export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export interface FetchRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignalLike;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}

export type FetchLike = (input: string | URL, init?: FetchRequestInit) => Promise<FetchResponseLike>;

export interface ClientRequestOptions {
  headers?: Record<string, string>;
  fetch?: FetchLike;
  signal?: AbortSignalLike;
}

export interface GetWellKnownOptions extends ClientRequestOptions {}
export interface DiscoverCapabilitiesOptions extends ClientRequestOptions {}

export interface ExecutionContextOptions {
  mode?: ExecutionMode;
  permissionScopes?: string[];
  allowDestructive?: boolean;
  confirmed?: boolean;
}

export interface ExecuteCapabilityOptions extends ClientRequestOptions {
  requestId?: string;
  confirmed?: boolean;
  context?: ExecutionContextOptions;
}

export interface DiscoverCapabilitiesResult {
  manifest: WellKnownResponse;
  capabilities: WellKnownCapability[];
  getCapabilityById(capabilityId: string): WellKnownCapability | undefined;
}

export type WellKnownManifest = WellKnownResponse;
export type ExecuteCapabilityResult = CapabilityExecutionResult;
