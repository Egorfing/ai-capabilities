import type { IncomingMessage } from "node:http";
import type { AiCapabilitiesManifest } from "../types/index.js";
import type { CapabilityRuntimeInterface, ExecutionMode } from "../runtime/runtime-types.js";
import type { JsonResponse } from "./response-builders.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Logger {
  log(message?: unknown, ...optional: unknown[]): void;
  error(message?: unknown, ...optional: unknown[]): void;
}

export interface ServerDependencies {
  manifest: AiCapabilitiesManifest;
  publicManifest?: AiCapabilitiesManifest;
  runtime: CapabilityRuntimeInterface;
  tracesDir?: string;
  logger?: Logger;
}

export interface ServerOptions {
  host?: string;
  port?: number;
  mode?: ExecutionMode;
}

export interface ServerInfo {
  host: string;
  port: number;
  mode: ExecutionMode;
}

export interface CapabilityHttpServer {
  listen(): Promise<ServerInfo>;
  close(): Promise<void>;
  getInfo(): ServerInfo;
}

export interface ServerState {
  manifest: AiCapabilitiesManifest;
  publicManifest?: AiCapabilitiesManifest;
  runtime: CapabilityRuntimeInterface;
  mode: ExecutionMode;
  tracesDir?: string;
  logger: Logger;
}

export interface RouteContext {
  req: IncomingMessage;
  url: URL;
  state: ServerState;
  traceId: string;
  recordEvent: (eventType: string, message: string, data?: Record<string, unknown>) => Promise<void>;
}

export interface RouteResult {
  statusCode: number;
  body: JsonResponse;
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
