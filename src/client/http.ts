import { AiCapabilitiesClientError } from "./errors.js";
import type {
  ClientRequestOptions,
  FetchLike,
  FetchRequestInit,
  FetchResponseLike,
  AbortSignalLike,
} from "./types.js";

interface SuccessEnvelope<T> {
  status: "success";
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorEnvelope {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

type JsonEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export interface JsonRequestConfig {
  method: string;
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignalLike;
}

export interface JsonResponsePayload<T> {
  envelope: JsonEnvelope<T>;
  response: FetchResponseLike;
}

export async function requestJson<T>(
  url: string,
  config: JsonRequestConfig,
  options?: ClientRequestOptions,
): Promise<JsonResponsePayload<T>> {
  const fetchImpl = resolveFetch(options?.fetch);
  const init: FetchRequestInit = {
    method: config.method,
    headers: mergeHeaders(config.headers, options?.headers),
    body: config.body,
    signal: config.signal ?? options?.signal,
  };

  let response: FetchResponseLike;
  try {
    response = await fetchImpl(url, init);
  } catch (err) {
    throw new AiCapabilitiesClientError(`Request to ${url} failed`, { cause: err });
  }

  const envelope = await parseJsonEnvelope<T>(response, url);
  return { envelope, response };
}

export function ensureSuccessEnvelope<T>(
  payload: JsonResponsePayload<T>,
  url: string,
): SuccessEnvelope<T> {
  if (payload.envelope.status === "success") {
    return payload.envelope;
  }

  const error = payload.envelope.error;
  throw new AiCapabilitiesClientError(
    `Request to ${url} failed: ${error.message}`,
    {
      status: payload.response.status,
      code: error.code,
      details: error.details,
    },
  );
}

/**
 * Resolve a capability endpoint URL from a base URL and path.
 *
 * **Security note:** `baseUrl` must be a trusted origin controlled by
 * your application. Never pass user-supplied or untrusted URLs as `baseUrl`
 * — doing so may enable Server-Side Request Forgery (SSRF).
 */
export function resolveEndpoint(baseUrl: string, path: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch (err) {
    throw new AiCapabilitiesClientError(`Invalid baseUrl "${baseUrl}"`, { cause: err });
  }
}

function resolveFetch(fetchOverride?: FetchLike): FetchLike {
  if (fetchOverride) {
    return fetchOverride;
  }
  const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
  if (!globalFetch) {
    throw new AiCapabilitiesClientError("fetch is not available. Provide options.fetch to supply an implementation.");
  }
  return globalFetch;
}

async function parseJsonEnvelope<T>(response: FetchResponseLike, url: string): Promise<JsonEnvelope<T>> {
  let text: string;
  try {
    text = await response.text();
  } catch (err) {
    throw new AiCapabilitiesClientError(`Failed to read response from ${url}`, {
      status: response.status,
      cause: err,
    });
  }

  if (!text) {
    throw new AiCapabilitiesClientError(`Empty response from ${url}`, { status: response.status });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new AiCapabilitiesClientError(`Invalid JSON response from ${url}`, {
      status: response.status,
      cause: err,
    });
  }

  if (!isJsonEnvelope<T>(parsed)) {
    throw new AiCapabilitiesClientError(`Unexpected response shape from ${url}`, { status: response.status });
  }

  return parsed;
}

function mergeHeaders(
  requestHeaders?: Record<string, string>,
  optionHeaders?: Record<string, string>,
): Record<string, string> | undefined {
  const headers = { Accept: "application/json", ...requestHeaders };
  if (optionHeaders) {
    return { ...headers, ...optionHeaders };
  }
  return headers;
}

function isJsonEnvelope<T>(value: unknown): value is JsonEnvelope<T> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const envelope = value as Record<string, unknown>;
  if (envelope.status === "success") {
    return envelope.data !== undefined;
  }
  if (envelope.status === "error") {
    const err = envelope.error;
    return typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string";
  }
  return false;
}
