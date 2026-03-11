import type { AiCapabilitiesManifest, AiCapability } from "../types/index.js";
import { BindingRegistry } from "./binding-registry.js";
import type {
  BindingResolution,
  ResolvedCapabilityBinding,
  CapabilityBinding,
  BindingError,
} from "./binding-types.js";
import {
  bindingNotFound,
  capabilityNotFound,
  invalidBinding,
  unsupportedBindingMode,
} from "./binding-errors.js";

export class BindingResolver {
  private readonly manifest: AiCapabilitiesManifest;
  private readonly registry: BindingRegistry;
  private readonly capabilityMap = new Map<string, AiCapability>();

  constructor(manifest: AiCapabilitiesManifest, registry: BindingRegistry) {
    this.manifest = manifest;
    this.registry = registry;
    for (const capability of manifest.capabilities) {
      this.capabilityMap.set(capability.id, capability);
    }
  }

  resolve(capabilityId: string): BindingResolution {
    const explicit = this.registry.get(capabilityId);
    if (explicit) {
      return {
        ok: true,
        binding: { ...explicit, source: "explicit" },
      };
    }

    const capability = this.capabilityMap.get(capabilityId);
    if (!capability) {
      return { ok: false, error: capabilityNotFound(capabilityId) };
    }

    const fallback = this.fromExecution(capability);
    if (fallback.error) {
      return { ok: false, error: fallback.error };
    }
    if (!fallback.binding) {
      return { ok: false, error: bindingNotFound(capabilityId) };
    }

    return {
      ok: true,
      binding: { ...fallback.binding, source: "manifest" },
    };
  }

  private fromExecution(capability: AiCapability): { binding?: CapabilityBinding; error?: BindingError } {
    const exec = capability.execution;
    if (!exec) return {};

    switch (exec.mode) {
      case "http":
        if (!exec.endpoint) {
          return { error: invalidBinding(`Capability "${capability.id}" has http mode without endpoint`) };
        }
        return {
          binding: {
            capabilityId: capability.id,
            mode: "http",
            endpoint: {
              method: exec.endpoint.method,
              path: exec.endpoint.path,
              baseUrl: exec.endpoint.baseUrl,
              headers: exec.endpoint.headers,
            },
          },
        };
      case "frontend-bridge":
        return {
          binding: {
            capabilityId: capability.id,
            mode: "frontend-bridge",
            bridgeAction: exec.handlerRef ?? capability.navigation?.route ?? capability.id,
          },
        };
      default:
        return { error: unsupportedBindingMode(exec.mode ?? "unknown") };
    }
  }
}
