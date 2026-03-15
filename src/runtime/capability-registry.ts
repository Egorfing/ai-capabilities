import type { CapabilityHandler } from "./runtime-types.js";
import type { AiCapability, JsonSchema } from "../types/index.js";

export interface CapabilityOverrides {
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  policy?: Partial<AiCapability["policy"]>;
  metadata?: Record<string, unknown>;
}

export interface CapabilityRegistryRegisterOptions {
  overrides?: CapabilityOverrides;
}

export class CapabilityRegistry {
  private readonly handlers = new Map<string, CapabilityHandler>();
  private readonly overrides = new Map<string, CapabilityOverrides>();

  register(capabilityId: string, handler: CapabilityHandler, options?: CapabilityRegistryRegisterOptions): void {
    this.handlers.set(capabilityId, handler);
    if (options?.overrides) {
      this.overrides.set(capabilityId, options.overrides);
    }
  }

  getHandler(capabilityId: string): CapabilityHandler | undefined {
    return this.handlers.get(capabilityId);
  }

  hasHandler(capabilityId: string): boolean {
    return this.handlers.has(capabilityId);
  }

  getOverrides(capabilityId: string): CapabilityOverrides | undefined {
    return this.overrides.get(capabilityId);
  }
}
