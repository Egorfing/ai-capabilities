// ---------------------------------------------------------------------------
// Policy layer: main checker
// ---------------------------------------------------------------------------

import type {
  AiCapability,
  ManifestDefaults,
} from "../types/index.js";
import type {
  PolicyDecision,
  PolicyReason,
  PolicyRule,
  ResolvedPolicy,
  CapabilityExecutionContext,
} from "./policy-types.js";
import { defaultPolicyRules } from "./policy-rules.js";

// ---- Fallback defaults ----------------------------------------------------

/**
 * Safe fallback values used when neither the capability nor the manifest
 * provides a policy field.
 *
 * Design intent: when in doubt, restrict access (internal) and require
 * minimal risk (low).
 */
const FALLBACK_DEFAULTS: Required<ManifestDefaults> = {
  visibility: "internal",
  riskLevel: "low",
  confirmationPolicy: "none",
};

// ---- Resolve policy -------------------------------------------------------

/**
 * Merge a capability's policy with manifest defaults and safe fallbacks.
 *
 * Precedence (highest to lowest):
 *  1. capability.policy fields
 *  2. manifestDefaults
 *  3. FALLBACK_DEFAULTS
 */
export function resolvePolicy(
  capability: AiCapability,
  manifestDefaults?: ManifestDefaults,
): ResolvedPolicy {
  const defaults = manifestDefaults ?? FALLBACK_DEFAULTS;
  const cap = capability.policy ?? ({} as Partial<AiCapability["policy"]>);

  return {
    visibility: cap.visibility ?? defaults.visibility ?? FALLBACK_DEFAULTS.visibility,
    riskLevel: cap.riskLevel ?? defaults.riskLevel ?? FALLBACK_DEFAULTS.riskLevel,
    confirmationPolicy:
      cap.confirmationPolicy ??
      defaults.confirmationPolicy ??
      FALLBACK_DEFAULTS.confirmationPolicy,
    permissionScope: cap.permissionScope ?? [],
  };
}

// ---- Evaluate policy ------------------------------------------------------

export interface EvaluatePolicyOptions {
  /** Manifest-level default policy values. */
  manifestDefaults?: ManifestDefaults;
  /**
   * Custom rule set.  When omitted the built-in `defaultPolicyRules` are
   * used.  Pass an empty array to skip all rules.
   */
  rules?: PolicyRule[];
}

/**
 * Evaluate all policy rules against a capability + execution context and
 * produce a structured {@link PolicyDecision}.
 *
 * The decision distinguishes three outcomes:
 *  1. **Allowed**  — `allowed=true, requiresConfirmation=false`
 *  2. **Needs confirmation** — `allowed=true, requiresConfirmation=true`
 *  3. **Denied** — `allowed=false`
 *
 * Hard-deny reasons (visibility, permissions, risk) take precedence over
 * confirmation requirements.
 */
export function evaluatePolicy(
  capability: AiCapability,
  context: CapabilityExecutionContext,
  options?: EvaluatePolicyOptions,
): PolicyDecision {
  const resolved = resolvePolicy(capability, options?.manifestDefaults);
  const rules = options?.rules ?? defaultPolicyRules;

  // Collect all violations
  const reasons: PolicyReason[] = [];
  for (const rule of rules) {
    const reason = rule(resolved, context);
    if (reason) {
      reasons.push(reason);
    }
  }

  // Partition into hard denies vs. confirmation requests
  const denyReasons = reasons.filter((r) => r.code !== "CONFIRMATION_REQUIRED");
  const confirmationReasons = reasons.filter((r) => r.code === "CONFIRMATION_REQUIRED");

  // Hard deny takes precedence
  if (denyReasons.length > 0) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reasons,
    };
  }

  // Confirmation required (but otherwise allowed)
  if (confirmationReasons.length > 0) {
    return {
      allowed: true,
      requiresConfirmation: true,
      reasons: confirmationReasons,
    };
  }

  // Fully allowed
  return {
    allowed: true,
    requiresConfirmation: false,
    reasons: [],
  };
}
