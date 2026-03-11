// ---------------------------------------------------------------------------
// Policy layer: public API
// ---------------------------------------------------------------------------

export type {
  PolicyReasonCode,
  PolicyReason,
  PolicyDecision,
  CapabilityExecutionContext,
  ResolvedPolicy,
  PolicyRule,
} from "./policy-types.js";

export {
  visibilityRule,
  permissionScopeRule,
  destructiveRule,
  confirmationRule,
  defaultPolicyRules,
} from "./policy-rules.js";

export { evaluatePolicy, resolvePolicy } from "./policy-checker.js";
export type { EvaluatePolicyOptions } from "./policy-checker.js";
