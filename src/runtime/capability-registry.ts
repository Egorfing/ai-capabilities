import type { CapabilityHandler } from "./runtime-types.js";

export class CapabilityRegistry {
  private readonly handlers = new Map<string, CapabilityHandler>();

  register(capabilityId: string, handler: CapabilityHandler): void {
    this.handlers.set(capabilityId, handler);
  }

  getHandler(capabilityId: string): CapabilityHandler | undefined {
    return this.handlers.get(capabilityId);
  }

  hasHandler(capabilityId: string): boolean {
    return this.handlers.has(capabilityId);
  }
}
