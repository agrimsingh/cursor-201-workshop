import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError, ForbiddenError } from "@/lib/domain/errors";
import { assertCan, can, CAPABILITIES } from "@/lib/domain/permissions";
import { ApiError, toErrorResponse } from "@/lib/http/errors";

describe("permissions", () => {
  it("gives viewers no write access, agents day-to-day work and admins everything", () => {
    expect(CAPABILITIES.filter((c) => can("viewer", c))).toEqual([]);
    expect(can("agent", "payments:record")).toBe(true);
    expect(can("agent", "invoices:void")).toBe(false);
    expect(can("agent", "credit_notes:issue")).toBe(false);
    expect(CAPABILITIES.every((c) => can("admin", c))).toBe(true);
  });

  it("throws a ForbiddenError naming the actor and capability", () => {
    expect(() => assertCan({ id: "u", name: "Priya", role: "viewer" }, "disputes:open")).toThrow(ForbiddenError);
    expect(() => assertCan({ id: "u", name: "Priya", role: "viewer" }, "disputes:open")).toThrow(/Priya \(viewer\)/);
  });
});

describe("error responses", () => {
  async function render(error: unknown) {
    const response = toErrorResponse(error);
    return { status: response.status, body: await response.json() };
  }

  it("maps zod errors to 400 VALIDATION_FAILED with field paths", async () => {
    const result = z.object({ amountMinor: z.number().int() }).safeParse({ amountMinor: 1.5 });
    const { status, body } = await render(result.error);
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details[0].path).toBe("amountMinor");
  });

  it.each([
    [new DomainError("INVALID_TRANSITION", "nope"), 409],
    [new DomainError("BUSINESS_RULE", "nope"), 422],
    [new DomainError("OVER_ALLOCATION", "nope"), 422],
    [new DomainError("CURRENCY_MISMATCH", "nope"), 422],
    [new ForbiddenError("nope"), 403],
    [new DomainError("NOT_FOUND", "nope"), 404],
    [new ApiError("BAD_REQUEST", "nope"), 400],
  ])("maps %s to %i", async (error, status) => {
    const rendered = await render(error);
    expect(rendered.status).toBe(status);
    expect(rendered.body).toEqual({ error: expect.objectContaining({ code: error.code, message: "nope" }) });
  });

  it("hides unexpected errors behind INTERNAL", async () => {
    const original = console.error;
    console.error = () => {};
    const { status, body } = await render(new Error("database password is hunter2"));
    console.error = original;
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL", message: "Something went wrong" } });
  });
});
