// ---------------------------------------------------------------------------
// Policy layer: type definitions
// ---------------------------------------------------------------------------

import type { Visibility, RiskLevel, ConfirmationPolicy } from "../types/index.js";

// ---- Reason codes ---------------------------------------------------------

/** Codes identifying specific policy violations. */
export type PolicyReasonCode =
  | "VISIBILITY_DENIED"
  | "MISSING_PERMISSION_SCOPE"
  | "DESTRUCTIVE_NOT_ALLOWED"
  | "CONFIRMATION_REQUIRED";

/** A single reason explaining a policy decision. */
export interface PolicyReason {
  code: PolicyReasonCode;
  message: string;
}

// ---- Decision -------------------------------------------------------------

/**
 * Structured result of policy evaluation.
 *
 * Three possible outcomes:
 *  1. `allowed=true, requiresConfirmation=false`  — execute immediately
 *  2. `allowed=true, requiresConfirmation=true`   — execute after user confirms
 *  3. `allowed=false`                              — deny execution
 */
export interface PolicyDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reasons: PolicyReason[];
}

// ---- Execution context ----------------------------------------------------

/**
 * Context describing *how* a capability is being invoked.
 *
 * Provided by the caller at execution time — not stored in the manifest.
 * Intentionally decoupled from any real auth/session system.
 */
export interface CapabilityExecutionContext {
  /** Runtime execution mode. */
  mode: "internal" | "public";
  /** Permission scopes granted to the current caller. */
  permissionScopes?: string[];
  /** Whether destructive / high-risk operations are allowed. */
  allowDestructive?: boolean;
  /** Whether the user has explicitly confirmed this invocation. */
  confirmed?: boolean;
}

// ---- Resolved policy ------------------------------------------------------

/**
 * Fully-resolved policy for a capability.
 *
 * Built by merging capability.policy → manifest defaults → safe fallbacks.
 * Every field is guaranteed to be present.
 */
export interface ResolvedPolicy {
  visibility: Visibility;
  riskLevel: RiskLevel;
  confirmationPolicy: ConfirmationPolicy;
  permissionScope: string[];
}

// ---- Rule interface -------------------------------------------------------

/**
 * A single policy rule.
 *
 * Returns a `PolicyReason` if the rule is violated, or `null` if the rule
 * passes.  Rules are composable — the policy checker runs all registered
 * rules and aggregates their results.
 */
export type PolicyRule = (
  policy: ResolvedPolicy,
  context: CapabilityExecutionContext,
) => PolicyReason | null;
