export interface AiCapabilitiesClientErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AiCapabilitiesClientError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, options: AiCapabilitiesClientErrorOptions = {}) {
    super(message);
    this.name = "AiCapabilitiesClientError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}
