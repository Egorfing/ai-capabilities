import { describe, it, expect, vi } from "vitest";
import { parseExecutePayload } from "./request-parsers.js";
import { HttpError } from "./server-types.js";

describe("parseExecutePayload", () => {
  it("returns correct result for valid payload", () => {
    const payload = parseExecutePayload({
      capabilityId: "orders.create",
      input: { orderId: "123" },
      confirmed: true,
    });
    expect(payload.capabilityId).toBe("orders.create");
    expect(payload.input).toEqual({ orderId: "123" });
    expect(payload.confirmed).toBe(true);
  });

  it("defaults input to empty object when omitted", () => {
    const payload = parseExecutePayload({
      capabilityId: "orders.list",
    });
    expect(payload.input).toEqual({});
  });

  it("throws 400 when capabilityId is missing", () => {
    expect(() => parseExecutePayload({ input: {} })).toThrowError();
    try {
      parseExecutePayload({ input: {} });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });

  it("throws 400 when capabilityId is an empty string", () => {
    expect(() => parseExecutePayload({ capabilityId: "  ", input: {} })).toThrowError();
    try {
      parseExecutePayload({ capabilityId: "  ", input: {} });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });

  it("throws 400 when capabilityId exceeds 256 characters", () => {
    const longId = "a".repeat(257);
    expect(() => parseExecutePayload({ capabilityId: longId, input: {} })).toThrowError();
    try {
      parseExecutePayload({ capabilityId: longId, input: {} });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
      expect((err as HttpError).message).toContain("maximum length");
    }
  });

  it("accepts a capabilityId of exactly 256 characters", () => {
    const exactId = "a".repeat(256);
    const payload = parseExecutePayload({ capabilityId: exactId });
    expect(payload.capabilityId).toBe(exactId);
  });

  it("throws 400 when body is not an object", () => {
    expect(() => parseExecutePayload("not an object")).toThrowError();
    try {
      parseExecutePayload("not an object");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
      expect((err as HttpError).message).toContain("object");
    }
  });

  it("throws 400 when body is null", () => {
    expect(() => parseExecutePayload(null)).toThrowError();
    try {
      parseExecutePayload(null);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });

  it("throws 400 when body is an array", () => {
    expect(() => parseExecutePayload([1, 2, 3])).toThrowError();
    try {
      parseExecutePayload([1, 2, 3]);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });

  it("parses context when provided", () => {
    const payload = parseExecutePayload({
      capabilityId: "orders.create",
      input: {},
      context: {
        mode: "public",
        allowDestructive: true,
        permissionScopes: ["orders:write"],
      },
    });
    expect(payload.context.mode).toBe("public");
    expect(payload.context.allowDestructive).toBe(true);
    expect(payload.context.permissionScopes).toEqual(["orders:write"]);
  });
});
