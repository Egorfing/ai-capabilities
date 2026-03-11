// ---------------------------------------------------------------------------
// Policy layer: built-in rules
// ---------------------------------------------------------------------------

import type { PolicyRule, PolicyReason } from "./policy-types.js";

// ---- Rule 1: Visibility ---------------------------------------------------

/**
 * Internal capabilities must not be executed in public mode.
 */
export const visibilityRule: PolicyRule = (policy, context): PolicyReason | null => {
  if (policy.visibility === "internal" && context.mode === "public") {
    return {
      code: "VISIBILITY_DENIED",
      message: `Capability with visibility "internal" cannot be executed in public mode`,
    };
  }
  return null;
};

// ---- Rule 2: Permission scope ---------------------------------------------

/**
 * All required permission scopes must be present in the execution context.
 * If the capability has no permissionScope requirements, the rule passes.
 */
export const permissionScopeRule: PolicyRule = (policy, context): PolicyReason | null => {
  if (policy.permissionScope.length === 0) return null;

  const granted = new Set(context.permissionScopes ?? []);
  const missing = policy.permissionScope.filter((scope) => !granted.has(scope));

  if (missing.length > 0) {
    return {
      code: "MISSING_PERMISSION_SCOPE",
      message: `Missing required permission scopes: ${missing.join(", ")}`,
    };
  }
  return null;
};

// ---- Rule 3: Destructive / high-risk --------------------------------------

/**
 * Capabilities with riskLevel "high" or "critical" require an explicit
 * `allowDestructive` flag in the execution context.
 */
export const destructiveRule: PolicyRule = (policy, context): PolicyReason | null => {
  if (
    (policy.riskLevel === "high" || policy.riskLevel === "critical") &&
    context.allowDestructive !== true
  ) {
    return {
      code: "DESTRUCTIVE_NOT_ALLOWED",
      message: `Capability with riskLevel "${policy.riskLevel}" requires allowDestructive to be true`,
    };
  }
  return null;
};

// ---- Rule 4: Confirmation -------------------------------------------------

/**
 * If the confirmation policy is anything other than "none", the request
 * must include `confirmed: true`.
 *
 * This rule does NOT deny execution — it signals that confirmation is
 * required.  The caller (runtime) distinguishes this from a hard deny.
 */
export const confirmationRule: PolicyRule = (policy, context): PolicyReason | null => {
  if (policy.confirmationPolicy !== "none" && context.confirmed !== true) {
    return {
      code: "CONFIRMATION_REQUIRED",
      message: `Capability requires confirmation (policy: "${policy.confirmationPolicy}")`,
    };
  }
  return null;
};

// ---- Aggregate ------------------------------------------------------------

/**
 * Default ordered set of all built-in policy rules.
 *
 * Order matters: hard-deny rules run first (visibility, permissions,
 * destructive), confirmation rule runs last so it only fires when
 * execution is otherwise allowed.
 */
export const defaultPolicyRules: PolicyRule[] = [
  visibilityRule,
  permissionScopeRule,
  destructiveRule,
  confirmationRule,
];
