import type { AiCapabilitiesManifest } from "../types/index.js";
import { CapabilityRegistry } from "../runtime/capability-registry.js";
import { BindingRegistry } from "./binding-registry.js";
import { BindingResolver } from "./binding-resolver.js";
import type { ManualCapabilityBinding } from "./binding-types.js";

export interface CreateBoundRegistryOptions {
  manifest: AiCapabilitiesManifest;
  bindingRegistry?: BindingRegistry;
  capabilityRegistry?: CapabilityRegistry;
}

export function createBoundRegistry(options: CreateBoundRegistryOptions): {
  registry: CapabilityRegistry;
  bindingRegistry: BindingRegistry;
  resolver: BindingResolver;
} {
  const bindingRegistry = options.bindingRegistry ?? new BindingRegistry();
  const capabilityRegistry = options.capabilityRegistry ?? new CapabilityRegistry();

  for (const binding of bindingRegistry.list()) {
    if (binding.mode === "manual") {
      const manual = binding as ManualCapabilityBinding;
      capabilityRegistry.register(manual.capabilityId, manual.handler);
    }
  }

  const resolver = new BindingResolver(options.manifest, bindingRegistry);
  return { registry: capabilityRegistry, bindingRegistry, resolver };
}
