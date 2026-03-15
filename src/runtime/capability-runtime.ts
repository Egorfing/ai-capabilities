import Ajv from "ajv";
import type { ValidateFunction, Ajv as AjvInstance } from "ajv";
import type {
  AiCapabilitiesManifest,
  AiCapability,
  JsonSchema,
  CapabilityExecutionRequest,
  CapabilityExecutionResult,
  ExecutionStatus,
} from "../types/index.js";
import { CapabilityRegistry } from "./capability-registry.js";
import type { CapabilityRuntimeExecuteOptions, ExecutionMode } from "./runtime-types.js";
import { evaluatePolicy } from "../policy/index.js";
import type { CapabilityExecutionContext } from "../policy/index.js";
import type { RuntimeError } from "./runtime-errors.js";
import {
  capabilityNotFound,
  handlerError,
  handlerNotFound,
  invalidInput,
  policyDenied,
  policyConfirmationRequired,
} from "./runtime-errors.js";
import type { TraceWriter } from "../trace/trace-types.js";
import { runtimeEvent, policyEvent } from "../trace/trace-utils.js";
import { generateTraceId } from "../trace/trace-id.js";

export interface CapabilityRuntimeOptions {
  manifest: AiCapabilitiesManifest;
  registry: CapabilityRegistry;
  mode?: ExecutionMode;
  /** Optional trace writer for runtime observability. */
  traceWriter?: TraceWriter;
}

export class CapabilityRuntime {
  private readonly manifest: AiCapabilitiesManifest;
  private readonly registry: CapabilityRegistry;
  private readonly defaultMode: ExecutionMode;
  private readonly validatorCache = new Map<string, ValidateFunction>();
  private readonly capabilityMap = new Map<string, AiCapability>();
  private readonly ajv: AjvInstance;
  private readonly traceWriter?: TraceWriter;

  constructor(options: CapabilityRuntimeOptions) {
    this.manifest = options.manifest;
    this.registry = options.registry;
    this.defaultMode = options.mode ?? "internal";
    this.traceWriter = options.traceWriter;

    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
      useDefaults: true,
    });

    for (const capability of options.manifest.capabilities) {
      const merged = this.applyAuthoredOverrides(capability);
      this.capabilityMap.set(capability.id, merged);
    }
  }

  async execute(
    request: CapabilityExecutionRequest,
    options: CapabilityRuntimeExecuteOptions = {},
  ): Promise<CapabilityExecutionResult> {
    const start = Date.now();
    const tw = this.traceWriter;
    const traceId = request.requestId ?? generateTraceId();
    const reqId = request.requestId;

    if (tw) {
      await tw.write(runtimeEvent(traceId, "execution.started", `Executing "${request.capabilityId}"`, {
        capabilityId: request.capabilityId,
        requestId: reqId,
        data: { mode: options.mode ?? this.defaultMode },
      }));
    }

    const capability = this.capabilityMap.get(request.capabilityId);
    if (!capability) {
      const result = this.buildResult(request, "error", capabilityNotFound(request.capabilityId), start);
      if (tw) {
        await tw.write(runtimeEvent(traceId, "execution.error", `Capability "${request.capabilityId}" not found`, {
          level: "error", capabilityId: request.capabilityId, requestId: reqId,
        }));
      }
      return result;
    }

    if (tw) {
      await tw.write(runtimeEvent(traceId, "capability.resolved", `Capability "${capability.id}" resolved`, {
        capabilityId: capability.id, requestId: reqId,
        data: { kind: capability.kind },
      }));
    }

    const handler = this.registry.getHandler(request.capabilityId);
    if (!handler) {
      const result = this.buildResult(request, "error", handlerNotFound(request.capabilityId), start);
      if (tw) {
        await tw.write(runtimeEvent(traceId, "execution.error", `Handler not found for "${request.capabilityId}"`, {
          level: "error", capabilityId: request.capabilityId, requestId: reqId,
        }));
      }
      return result;
    }

    const input = request.input ?? {};
    const validator = this.getValidator(capability);
    const valid = validator(input);
    if (!valid) {
      return this.buildResult(request, "error", invalidInput(validator.errors), start);
    }

    // Build execution context from options + request
    const executionContext: CapabilityExecutionContext = {
      mode: options.mode ?? this.defaultMode,
      permissionScopes: options.permissionScopes,
      allowDestructive: options.allowDestructive,
      confirmed: request.confirmed,
    };

    // Evaluate policy
    const decision = evaluatePolicy(capability, executionContext, {
      manifestDefaults: this.manifest.defaults,
    });

    if (tw) {
      await tw.write(policyEvent(traceId, "policy.checked", `Policy decision for "${capability.id}": allowed=${decision.allowed}, confirmation=${decision.requiresConfirmation}`, {
        level: decision.allowed ? "info" : "warning",
        capabilityId: capability.id, requestId: reqId,
        data: { allowed: decision.allowed, requiresConfirmation: decision.requiresConfirmation, reasonCount: decision.reasons.length },
      }));
    }

    if (!decision.allowed) {
      const msg = decision.reasons.map((r) => r.message).join("; ");
      if (tw) {
        await tw.write(policyEvent(traceId, "policy.denied", `Policy denied "${capability.id}": ${msg}`, {
          level: "warning", capabilityId: capability.id, requestId: reqId,
          data: { reasons: decision.reasons.map((r) => r.code) },
        }));
      }
      return this.buildResult(
        request,
        "denied",
        policyDenied(msg, { reasons: decision.reasons }),
        start,
      );
    }

    if (decision.requiresConfirmation) {
      const msg = decision.reasons.map((r) => r.message).join("; ");
      if (tw) {
        await tw.write(policyEvent(traceId, "policy.confirmation_required", `Confirmation required for "${capability.id}"`, {
          level: "warning", capabilityId: capability.id, requestId: reqId,
        }));
      }
      return this.buildResult(
        request,
        "pending",
        policyConfirmationRequired(msg, { reasons: decision.reasons }),
        start,
      );
    }

    if (tw) {
      await tw.write(runtimeEvent(traceId, "handler.invoked", `Invoking handler for "${capability.id}"`, {
        capabilityId: capability.id, requestId: reqId,
      }));
    }

    try {
      const data = await handler(input, options.handlerContext);
      const result = this.buildSuccess(request, data, start);
      if (tw) {
        await tw.write(runtimeEvent(traceId, "execution.success", `Execution succeeded for "${capability.id}"`, {
          capabilityId: capability.id, requestId: reqId,
          data: { durationMs: result.durationMs },
        }));
      }
      return result;
    } catch (err) {
      const result = this.buildResult(request, "error", handlerError(err), start);
      if (tw) {
        await tw.write(runtimeEvent(traceId, "execution.error", `Handler error for "${capability.id}": ${err instanceof Error ? err.message : String(err)}`, {
          level: "error", capabilityId: capability.id, requestId: reqId,
        }));
      }
      return result;
    }
  }

  getManifest(): AiCapabilitiesManifest {
    return this.manifest;
  }

  private applyAuthoredOverrides(capability: AiCapability): AiCapability {
    const overrides = this.registry.getOverrides(capability.id);
    if (!overrides) {
      return capability;
    }

    const mergedPolicy = overrides.policy
      ? {
          ...(capability.policy ?? {}),
          ...overrides.policy,
        }
      : capability.policy;

    const mergedMetadata = overrides.metadata
      ? {
          ...(capability.metadata ?? {}),
          ...overrides.metadata,
        }
      : capability.metadata;

    const merged: AiCapability = {
      ...capability,
      inputSchema: overrides.inputSchema ?? capability.inputSchema,
      outputSchema: overrides.outputSchema ?? capability.outputSchema,
      policy: mergedPolicy,
      metadata: mergedMetadata,
    };

    this.logOverrides(capability.id, overrides);
    return merged;
  }

  private logOverrides(capabilityId: string, overrides: ReturnType<CapabilityRegistry["getOverrides"]>): void {
    if (!overrides) return;
    const overriddenFields: string[] = [];
    if (overrides.policy) overriddenFields.push("policy");
    if (overrides.inputSchema) overriddenFields.push("inputSchema");
    if (overrides.outputSchema) overriddenFields.push("outputSchema");
    if (overrides.metadata) overriddenFields.push("metadata");
    if (overriddenFields.length === 0) return;
    console.warn(
      `[CapabilityRuntime] applying authored overrides for "${capabilityId}": ${overriddenFields.join(", ")}`,
    );
  }

  private getValidator(capability: AiCapability): ValidateFunction {
    if (this.validatorCache.has(capability.id)) {
      return this.validatorCache.get(capability.id)!;
    }
    const schema = (capability.inputSchema ?? { type: "object" }) as JsonSchema;
    const validator = this.ajv.compile(schema);
    this.validatorCache.set(capability.id, validator);
    return validator;
  }

  private buildResult(
    request: CapabilityExecutionRequest,
    status: ExecutionStatus,
    error: RuntimeError,
    start: number,
  ): CapabilityExecutionResult {
    return {
      capabilityId: request.capabilityId,
      requestId: request.requestId,
      status,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      durationMs: Date.now() - start,
    };
  }

  private buildSuccess(
    request: CapabilityExecutionRequest,
    data: unknown,
    start: number,
  ): CapabilityExecutionResult {
    return {
      capabilityId: request.capabilityId,
      requestId: request.requestId,
      status: "success",
      data,
      durationMs: Date.now() - start,
    };
  }
}
