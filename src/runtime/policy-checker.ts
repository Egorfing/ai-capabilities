// ---------------------------------------------------------------------------
// Legacy policy checker — delegates to src/policy/ module
// ---------------------------------------------------------------------------
//
// Kept for backward compatibility.  New code should import directly from
// "../policy/index.js" instead.
// ---------------------------------------------------------------------------

import type { AiCapability } from "../types/index.js";
import type { ExecutionMode } from "./runtime-types.js";
import { evaluatePolicy } from "../policy/index.js";
import { policyDenied } from "./runtime-errors.js";
import type { RuntimeError } from "./runtime-errors.js";

export interface PolicyContext {
  mode: ExecutionMode;
}

/**
 * @deprecated Use `evaluatePolicy` from `../policy/index.js` for structured
 * policy decisions (allowed / confirmation-required / denied).
 */
export function checkPolicy(
  capability: AiCapability,
  context: PolicyContext,
): RuntimeError | null {
  const decision = evaluatePolicy(capability, { mode: context.mode });
  if (!decision.allowed) {
    const msg = decision.reasons.map((r) => r.message).join("; ");
    return policyDenied(msg);
  }
  return null;
}
