// ---------------------------------------------------------------------------
// Lightweight manifest validator (no external deps)
// ---------------------------------------------------------------------------

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const CAPABILITY_KINDS = new Set([
  "read",
  "mutation",
  "navigation",
  "ui-action",
  "workflow",
]);

const SOURCE_TYPES = new Set([
  "openapi",
  "react-query",
  "router",
  "form",
  "manual",
  "custom",
]);

const RISK_LEVELS = new Set(["safe", "low", "medium", "high", "critical"]);
const CONFIRMATION_POLICIES = new Set(["none", "once", "always"]);
const VISIBILITIES = new Set(["public", "internal", "hidden"]);

const ID_PATTERN = /^[a-z][a-z0-9._-]*$/;

function pushIf(errors: ValidationError[], condition: boolean, path: string, message: string) {
  if (condition) errors.push({ path, message });
}

function validateRawCapability(cap: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = `capabilities[${index}]`;

  if (typeof cap !== "object" || cap === null) {
    return [{ path: p, message: "must be an object" }];
  }

  const c = cap as Record<string, unknown>;

  pushIf(errors, typeof c.id !== "string", `${p}.id`, "required string");
  if (typeof c.id === "string") {
    pushIf(errors, !ID_PATTERN.test(c.id), `${p}.id`, `must match ${ID_PATTERN}`);
  }

  pushIf(
    errors,
    typeof c.source !== "object" || c.source === null,
    `${p}.source`,
    "required object",
  );
  if (typeof c.source === "object" && c.source !== null) {
    const s = c.source as Record<string, unknown>;
    pushIf(errors, !SOURCE_TYPES.has(s.type as string), `${p}.source.type`, "invalid source type");
  }

  pushIf(errors, !CAPABILITY_KINDS.has(c.kind as string), `${p}.kind`, "invalid kind");
  pushIf(
    errors,
    typeof c.inputSchema !== "object" || c.inputSchema === null,
    `${p}.inputSchema`,
    "required object",
  );
  pushIf(
    errors,
    typeof c.metadata !== "object" || c.metadata === null,
    `${p}.metadata`,
    "required object",
  );

  return errors;
}

function validateEnrichedFields(cap: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = `capabilities[${index}]`;
  const c = cap as Record<string, unknown>;

  pushIf(errors, typeof c.displayTitle !== "string", `${p}.displayTitle`, "required string");
  pushIf(errors, typeof c.userDescription !== "string", `${p}.userDescription`, "required string");
  pushIf(errors, !Array.isArray(c.aliases), `${p}.aliases`, "required array");
  pushIf(errors, !Array.isArray(c.exampleIntents), `${p}.exampleIntents`, "required array");
  pushIf(
    errors,
    !CONFIRMATION_POLICIES.has(c.confirmationPolicy as string),
    `${p}.confirmationPolicy`,
    "invalid confirmation policy",
  );
  pushIf(errors, !RISK_LEVELS.has(c.riskLevel as string), `${p}.riskLevel`, "invalid risk level");
  pushIf(
    errors,
    !VISIBILITIES.has(c.visibility as string),
    `${p}.visibility`,
    "invalid visibility",
  );

  return errors;
}

function validateMeta(meta: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof meta !== "object" || meta === null) {
    return [{ path: "meta", message: "required object" }];
  }
  const m = meta as Record<string, unknown>;
  pushIf(errors, typeof m.generatedAt !== "string", "meta.generatedAt", "required string");
  pushIf(errors, typeof m.version !== "string", "meta.version", "required string");
  return errors;
}

/** Validate a raw capability manifest. */
export function validateRawManifest(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: [{ path: "", message: "manifest must be an object" }] };
  }

  const d = data as Record<string, unknown>;
  errors.push(...validateMeta(d.meta));

  if (!Array.isArray(d.capabilities)) {
    errors.push({ path: "capabilities", message: "required array" });
  } else {
    for (let i = 0; i < d.capabilities.length; i++) {
      errors.push(...validateRawCapability(d.capabilities[i], i));
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validate an enriched capability manifest. */
export function validateEnrichedManifest(data: unknown): ValidationResult {
  const base = validateRawManifest(data);
  const errors = [...base.errors];

  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.capabilities)) {
      for (let i = 0; i < d.capabilities.length; i++) {
        errors.push(...validateEnrichedFields(d.capabilities[i], i));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
