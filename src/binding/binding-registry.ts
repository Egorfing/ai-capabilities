import type { CapabilityBinding } from "./binding-types.js";

export class BindingRegistry {
  private readonly bindings = new Map<string, CapabilityBinding>();

  register(binding: CapabilityBinding): void {
    this.bindings.set(binding.capabilityId, binding);
  }

  get(capabilityId: string): CapabilityBinding | undefined {
    return this.bindings.get(capabilityId);
  }

  has(capabilityId: string): boolean {
    return this.bindings.has(capabilityId);
  }

  list(): CapabilityBinding[] {
    return Array.from(this.bindings.values());
  }
}
