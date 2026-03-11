import type { ServerResponse } from "node:http";
import type { JsonValue } from "./server-types.js";

export interface SuccessResponse<T = unknown> {
  status: "success";
  data: T;
  meta?: Record<string, JsonValue>;
}

export interface ErrorResponse {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: JsonValue;
  };
  meta?: Record<string, JsonValue>;
}

export type JsonResponse = SuccessResponse | ErrorResponse;

export function success<T>(data: T, meta?: Record<string, JsonValue>): SuccessResponse<T> {
  return meta ? { status: "success", data, meta } : { status: "success", data };
}

export function failure(
  code: string,
  message: string,
  details?: JsonValue,
  meta?: Record<string, JsonValue>,
): ErrorResponse {
  const error = details !== undefined ? { code, message, details } : { code, message };
  return meta ? { status: "error", error, meta } : { status: "error", error };
}

export function sendJson(res: ServerResponse, statusCode: number, payload: JsonResponse): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function withMeta(payload: JsonResponse, meta: Record<string, JsonValue>): JsonResponse {
  if (payload.meta) {
    return { ...payload, meta: { ...payload.meta, ...meta } };
  }
  return { ...payload, meta };
}
