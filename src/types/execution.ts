// ---------------------------------------------------------------------------
// Domain model: Capability execution request / result
// ---------------------------------------------------------------------------

/** A request to execute a specific capability. */
export interface CapabilityExecutionRequest {
  capabilityId: string;
  input: Record<string, unknown>;
  /** Caller-provided id for tracing / correlation. */
  requestId?: string;
  /** Whether the user has explicitly confirmed this action. */
  confirmed?: boolean;
}

export type ExecutionStatus = "success" | "error" | "denied" | "pending";

/** The result of executing a capability. */
export interface CapabilityExecutionResult {
  capabilityId: string;
  requestId?: string;
  status: ExecutionStatus;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Wall-clock duration in milliseconds. */
  durationMs?: number;
}
