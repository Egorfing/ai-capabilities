import { describe, it, expect } from "vitest";
import { evaluatePolicy, resolvePolicy } from "./policy-checker.js";
import type { AiCapability, ManifestDefaults } from "../types/index.js";
import type { CapabilityExecutionContext } from "./policy-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCapability(overrides: Partial<AiCapability> = {}): AiCapability {
  return {
    id: "test.cap",
    kind: "mutation",
    displayTitle: "Test",
    description: "Test capability",
    inputSchema: { type: "object" },
    policy: {
      visibility: "public",
      riskLevel: "low",
      confirmationPolicy: "none",
    },
    tags: [],
    sources: [{ type: "manual" }],
    ...overrides,
  };
}

const DEFAULTS: ManifestDefaults = {
  visibility: "public",
  riskLevel: "low",
  confirmationPolicy: "none",
};

// ---------------------------------------------------------------------------
// resolvePolicy
// ---------------------------------------------------------------------------

describe("resolvePolicy", () => {
  it("uses capability.policy fields when present", () => {
    const cap = makeCapability({
      policy: {
        visibility: "internal",
        riskLevel: "high",
        confirmationPolicy: "always",
        permissionScope: ["admin"],
      },
    });
    const resolved = resolvePolicy(cap, DEFAULTS);
    expect(resolved).toEqual({
      visibility: "internal",
      riskLevel: "high",
      confirmationPolicy: "always",
      permissionScope: ["admin"],
    });
  });

  it("falls back to manifest defaults when capability fields are missing", () => {
    const cap = makeCapability({
      policy: {} as AiCapability["policy"],
    });
    const resolved = resolvePolicy(cap, {
      visibility: "internal",
      riskLevel: "medium",
      confirmationPolicy: "once",
    });
    expect(resolved).toEqual({
      visibility: "internal",
      riskLevel: "medium",
      confirmationPolicy: "once",
      permissionScope: [],
    });
  });

  it("falls back to safe fallbacks when no defaults provided", () => {
    const cap = makeCapability({
      policy: {} as AiCapability["policy"],
    });
    const resolved = resolvePolicy(cap);
    expect(resolved).toEqual({
      visibility: "internal",
      riskLevel: "low",
      confirmationPolicy: "none",
      permissionScope: [],
    });
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — Rule 1: Visibility
// ---------------------------------------------------------------------------

describe("evaluatePolicy — visibility rule", () => {
  it("denies internal capability in public mode", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, visibility: "internal" },
    });
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reasons).toHaveLength(1);
    expect(decision.reasons[0].code).toBe("VISIBILITY_DENIED");
  });

  it("allows internal capability in internal mode", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, visibility: "internal" },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reasons).toHaveLength(0);
  });

  it("allows public capability in public mode", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, visibility: "public" },
    });
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — Rule 2: Permission scope
// ---------------------------------------------------------------------------

describe("evaluatePolicy — permission scope rule", () => {
  it("denies when required scopes are missing", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, permissionScope: ["orders:write", "admin"] },
    });
    const ctx: CapabilityExecutionContext = {
      mode: "internal",
      permissionScopes: ["orders:write"],
    };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.some((r) => r.code === "MISSING_PERMISSION_SCOPE")).toBe(true);
    expect(decision.reasons[0].message).toContain("admin");
  });

  it("allows when all scopes are granted", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, permissionScope: ["orders:write", "admin"] },
    });
    const ctx: CapabilityExecutionContext = {
      mode: "internal",
      permissionScopes: ["orders:write", "admin", "extra"],
    };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it("allows when no scopes are required", () => {
    const cap = makeCapability();
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
  });

  it("denies when scopes required but none granted", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, permissionScope: ["admin"] },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons[0].code).toBe("MISSING_PERMISSION_SCOPE");
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — Rule 3: Destructive / risk
// ---------------------------------------------------------------------------

describe("evaluatePolicy — destructive rule", () => {
  it("denies high-risk capability without allowDestructive", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, riskLevel: "high" },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.some((r) => r.code === "DESTRUCTIVE_NOT_ALLOWED")).toBe(true);
  });

  it("denies critical-risk capability without allowDestructive", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, riskLevel: "critical" },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.some((r) => r.code === "DESTRUCTIVE_NOT_ALLOWED")).toBe(true);
  });

  it("allows high-risk capability with allowDestructive", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, riskLevel: "high" },
    });
    const ctx: CapabilityExecutionContext = {
      mode: "internal",
      allowDestructive: true,
    };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it("allows medium-risk capability without allowDestructive", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, riskLevel: "medium" },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — Rule 4: Confirmation
// ---------------------------------------------------------------------------

describe("evaluatePolicy — confirmation rule", () => {
  it("returns requiresConfirmation when policy is 'once' and not confirmed", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, confirmationPolicy: "once" },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reasons).toHaveLength(1);
    expect(decision.reasons[0].code).toBe("CONFIRMATION_REQUIRED");
  });

  it("returns requiresConfirmation when policy is 'always' and not confirmed", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, confirmationPolicy: "always" },
    });
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it("allows when confirmed is true", () => {
    const cap = makeCapability({
      policy: { ...DEFAULTS, confirmationPolicy: "always" },
    });
    const ctx: CapabilityExecutionContext = {
      mode: "internal",
      confirmed: true,
    };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reasons).toHaveLength(0);
  });

  it("does not require confirmation when policy is 'none'", () => {
    const cap = makeCapability();
    const ctx: CapabilityExecutionContext = { mode: "internal" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — combined / edge cases
// ---------------------------------------------------------------------------

describe("evaluatePolicy — combined scenarios", () => {
  it("hard deny takes precedence over confirmation", () => {
    const cap = makeCapability({
      policy: {
        visibility: "internal",
        riskLevel: "low",
        confirmationPolicy: "always",
      },
    });
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    // Should be denied (visibility), not just confirmation-required
    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(false);
    // Both reasons should be present
    expect(decision.reasons.some((r) => r.code === "VISIBILITY_DENIED")).toBe(true);
    expect(decision.reasons.some((r) => r.code === "CONFIRMATION_REQUIRED")).toBe(true);
  });

  it("multiple deny reasons are aggregated", () => {
    const cap = makeCapability({
      policy: {
        visibility: "internal",
        riskLevel: "high",
        confirmationPolicy: "none",
        permissionScope: ["admin"],
      },
    });
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.length).toBeGreaterThanOrEqual(3);
    const codes = decision.reasons.map((r) => r.code);
    expect(codes).toContain("VISIBILITY_DENIED");
    expect(codes).toContain("MISSING_PERMISSION_SCOPE");
    expect(codes).toContain("DESTRUCTIVE_NOT_ALLOWED");
  });

  it("allows with custom empty rules array", () => {
    const cap = makeCapability({
      policy: {
        visibility: "internal",
        riskLevel: "high",
        confirmationPolicy: "always",
        permissionScope: ["admin"],
      },
    });
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx, {
      manifestDefaults: DEFAULTS,
      rules: [],
    });

    // No rules → no violations → allowed
    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reasons).toHaveLength(0);
  });

  it("defaults are applied when capability policy is incomplete", () => {
    const cap = makeCapability({
      policy: {} as AiCapability["policy"],
    });
    // Manifest defaults: visibility=public, riskLevel=low, confirmation=none
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx, { manifestDefaults: DEFAULTS });

    // With defaults, public+low+none → fully allowed
    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
  });

  it("safe fallbacks are used when no manifest defaults", () => {
    const cap = makeCapability({
      policy: {} as AiCapability["policy"],
    });
    // No manifest defaults → fallback: visibility=internal, risk=low, confirm=none
    const ctx: CapabilityExecutionContext = { mode: "public" };
    const decision = evaluatePolicy(cap, ctx);

    // Fallback visibility=internal + public mode → denied
    expect(decision.allowed).toBe(false);
    expect(decision.reasons[0].code).toBe("VISIBILITY_DENIED");
  });
});
