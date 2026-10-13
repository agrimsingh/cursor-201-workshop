import { beforeEach, describe, expect, it } from "vitest";
import { GET as getCollections } from "@/app/api/collections/route";
import { POST as resolveDispute } from "@/app/api/disputes/[id]/resolve/route";
import { POST as recordPayment } from "@/app/api/payments/route";
import { db } from "@/lib/db";
import type { CollectionsQueue } from "@/lib/domain/aging";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/domain/permissions";
import type { ApiErrorBody } from "@/lib/http/errors";
import { admin, agent, auditFor, callRoute, NOW, resetDatabase, viewer } from "./helpers";

beforeEach(resetDatabase);

interface ResolvedDispute {
  id: string;
  status: string;
  resolution: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
}

interface IssuedCreditNote {
  id: string;
  invoiceId: string;
  amountMinor: number;
  reason: string;
  disputeId: string | null;
}

type ResolveResponse = { data: { dispute: ResolvedDispute; creditNote: IssuedCreditNote | null } } & Partial<ApiErrorBody>;

const NOTE = "Customer sent proof; settling the disputed amount.";

async function findDispute(where: Prisma.DisputeWhereInput) {
  const dispute = await db.dispute.findFirst({ where, include: { invoice: true }, orderBy: { openedAt: "asc" } });
  if (!dispute) throw new Error(`No dispute matching ${JSON.stringify(where)} in the seed data`);
  return dispute;
}

function resolve(id: string, body: unknown, as: Actor = admin) {
  return callRoute<{ id: string }, ResolveResponse>(resolveDispute, {
    method: "POST",
    path: `/api/disputes/${id}/resolve`,
    params: { id },
    body,
    as,
  });
}

async function queuedInvoiceIds() {
  const { body } = await callRoute<Record<string, never>, { data: CollectionsQueue }>(getCollections, {
    path: "/api/collections",
    query: { asOf: NOW.toISOString() },
  });
  return body.data.items.map((item) => item.invoiceId);
}

function parse(json: string | null): Record<string, unknown> | null {
  return json === null ? null : (JSON.parse(json) as Record<string, unknown>);
}

describe("POST /api/disputes/:id/resolve", () => {
  it("[resolve-dispute] accepting issues a linked credit note, reduces the balance and settles the invoice", async () => {
    // Seeded under-review dispute: the whole invoice balance is disputed as a duplicate.
    const dispute = await findDispute({ status: "under_review" });
    const invoiceBefore = dispute.invoice;
    const expectedCredit = invoiceBefore.balanceMinor;
    expect(dispute.amountMinor).toBe(invoiceBefore.balanceMinor);

    const { status, body } = await resolve(dispute.id, { resolution: "accepted", note: NOTE });
    expect(status).toBe(200);
    expect(body.data.dispute).toMatchObject({
      id: dispute.id,
      status: "resolved",
      resolution: "accepted",
      resolutionNote: NOTE,
      resolvedById: admin.id,
    });
    expect(body.data.dispute.resolvedAt).toBeTruthy();
    expect(body.data.creditNote).toMatchObject({
      invoiceId: invoiceBefore.id,
      amountMinor: expectedCredit,
      reason: "dispute_settlement",
      disputeId: dispute.id,
    });

    const creditNote = await db.creditNote.findUnique({ where: { disputeId: dispute.id } });
    expect(creditNote).toMatchObject({ id: body.data.creditNote!.id, amountMinor: expectedCredit, issuedById: admin.id });

    const invoiceAfter = (await db.invoice.findUnique({ where: { id: invoiceBefore.id } }))!;
    expect(invoiceAfter).toMatchObject({
      status: "paid",
      balanceMinor: 0,
      amountCreditedMinor: invoiceBefore.amountCreditedMinor + expectedCredit,
    });

    expect((await auditFor(creditNote!.id)).map((entry) => entry.action)).toContain("credit_note.issued");
    expect((await auditFor(invoiceBefore.id)).map((entry) => entry.action)).toContain("invoice.settled");
  });

  it("[resolve-dispute] accepting a partial dispute credits only the disputed amount and leaves the rest owing", async () => {
    const candidates = await db.dispute.findMany({ where: { status: { in: ["open", "under_review"] } }, include: { invoice: true } });
    const dispute = candidates.find((candidate) => candidate.amountMinor < candidate.invoice.balanceMinor);
    if (!dispute) throw new Error("No partial active dispute in the seed data");

    const { status, body } = await resolve(dispute.id, { resolution: "accepted", note: NOTE });
    expect(status).toBe(200);
    expect(body.data.creditNote?.amountMinor).toBe(dispute.amountMinor);

    const invoiceAfter = (await db.invoice.findUnique({ where: { id: dispute.invoiceId } }))!;
    expect(invoiceAfter.balanceMinor).toBe(dispute.invoice.balanceMinor - dispute.amountMinor);
    expect(["partially_paid", "overdue"]).toContain(dispute.invoice.status);
    expect(invoiceAfter.status).toBe(dispute.invoice.status);
  });

  it("[resolve-dispute] accepting caps the credit at the remaining balance", async () => {
    const dispute = await findDispute({ status: "under_review" });
    const partPaymentMinor = Math.floor(dispute.invoice.balanceMinor / 4);
    const payment = await callRoute(recordPayment, {
      method: "POST",
      path: "/api/payments",
      body: {
        customerId: dispute.customerId,
        currency: dispute.currency,
        amountMinor: partPaymentMinor,
        method: "bank_transfer",
        receivedAt: NOW.toISOString(),
        allocation: { mode: "explicit", lines: [{ invoiceId: dispute.invoiceId, amountMinor: partPaymentMinor }] },
      },
    });
    expect(payment.status).toBe(201);
    const remainingMinor = dispute.invoice.balanceMinor - partPaymentMinor;
    expect(dispute.amountMinor).toBeGreaterThan(remainingMinor);

    const { status, body } = await resolve(dispute.id, { resolution: "accepted", note: NOTE });
    expect(status).toBe(200);
    expect(body.data.creditNote?.amountMinor).toBe(remainingMinor);
    const invoiceAfter = (await db.invoice.findUnique({ where: { id: dispute.invoiceId } }))!;
    expect(invoiceAfter).toMatchObject({ status: "paid", balanceMinor: 0 });
  });

  it("[resolve-dispute] accepting when the invoice is already paid in full issues no credit note", async () => {
    const dispute = await findDispute({ status: "open", invoice: { status: "overdue" } });
    const invoice = dispute.invoice;
    const payment = await callRoute(recordPayment, {
      method: "POST",
      path: "/api/payments",
      as: admin,
      body: {
        customerId: invoice.customerId,
        currency: invoice.currency,
        amountMinor: invoice.balanceMinor,
        method: "bank_transfer",
        receivedAt: NOW.toISOString(),
        allocation: { mode: "explicit", lines: [{ invoiceId: invoice.id, amountMinor: invoice.balanceMinor }] },
      },
    });
    expect(payment.status).toBe(201);

    const { status, body } = await resolve(dispute.id, { resolution: "accepted", note: NOTE });
    expect(status).toBe(200);
    expect(body.data.dispute).toMatchObject({ status: "resolved", resolution: "accepted" });
    expect(body.data.creditNote).toBeNull();
    expect(await db.creditNote.count({ where: { disputeId: dispute.id } })).toBe(0);
    expect((await db.invoice.findUnique({ where: { id: invoice.id } }))).toMatchObject({ status: "paid", balanceMinor: 0 });
  });

  it("[resolve-dispute] rejecting moves no money and puts the invoice back in the collections queue", async () => {
    const dispute = await findDispute({ status: { in: ["open", "under_review"] }, invoice: { status: "overdue" } });
    const creditNotesBefore = await db.creditNote.count();
    expect(await queuedInvoiceIds()).not.toContain(dispute.invoiceId);

    const { status, body } = await resolve(dispute.id, { resolution: "rejected", note: "The work was delivered as quoted." });
    expect(status).toBe(200);
    expect(body.data.dispute).toMatchObject({ status: "resolved", resolution: "rejected", resolvedById: admin.id });
    expect(body.data.creditNote).toBeNull();
    expect(await db.creditNote.count()).toBe(creditNotesBefore);
    expect(await db.creditNote.count({ where: { disputeId: dispute.id } })).toBe(0);

    const invoiceAfter = (await db.invoice.findUnique({ where: { id: dispute.invoiceId } }))!;
    expect(invoiceAfter).toMatchObject({ status: dispute.invoice.status, balanceMinor: dispute.invoice.balanceMinor });
    expect(await queuedInvoiceIds()).toContain(dispute.invoiceId);
  });

  it("[resolve-dispute] writes a dispute.resolved audit entry with the admin as actor and before/after snapshots", async () => {
    const dispute = await findDispute({ status: "open" });
    const { status, body } = await resolve(dispute.id, { resolution: "accepted", note: NOTE });
    expect(status).toBe(200);

    const entries = (await auditFor(dispute.id)).filter((entry) => entry.action === "dispute.resolved");
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry).toMatchObject({ entityType: "dispute", entityId: dispute.id, actorId: admin.id });

    const before = parse(entry.before);
    const after = parse(entry.after);
    expect(before).toMatchObject({ status: "open" });
    expect(before?.resolution ?? null).toBeNull();
    expect(after).toMatchObject({ status: "resolved", resolution: "accepted", creditNoteId: body.data.creditNote!.id });
  });

  it.each([
    ["an agent", agent],
    ["a viewer", viewer],
  ])("[resolve-dispute] forbids %s from resolving a dispute", async (_label, actor) => {
    const dispute = await findDispute({ status: "open" });
    const { status, body } = await resolve(dispute.id, { resolution: "accepted", note: NOTE }, actor);
    expect(status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect((await db.dispute.findUnique({ where: { id: dispute.id } }))?.status).toBe("open");
    expect(await db.creditNote.count({ where: { disputeId: dispute.id } })).toBe(0);
  });

  it("[resolve-dispute] resolving the same dispute twice fails with 409 and issues only one credit note", async () => {
    const dispute = await findDispute({ status: "open" });
    expect((await resolve(dispute.id, { resolution: "accepted", note: NOTE })).status).toBe(200);

    const again = await resolve(dispute.id, { resolution: "accepted", note: NOTE });
    expect(again.status).toBe(409);
    expect(again.body.error?.code).toBe("INVALID_TRANSITION");
    expect(await db.creditNote.count({ where: { disputeId: dispute.id } })).toBe(1);
    expect((await auditFor(dispute.id)).filter((entry) => entry.action === "dispute.resolved")).toHaveLength(1);
  });

  it("[resolve-dispute] cannot resolve a withdrawn dispute", async () => {
    const dispute = await findDispute({ status: "withdrawn" });
    const { status, body } = await resolve(dispute.id, { resolution: "rejected", note: NOTE });
    expect(status).toBe(409);
    expect(body.error?.code).toBe("INVALID_TRANSITION");
    expect((await db.dispute.findUnique({ where: { id: dispute.id } }))?.status).toBe("withdrawn");
  });

  it.each([
    ["the note is missing", { resolution: "accepted" }],
    ["the note is too short", { resolution: "accepted", note: "ok" }],
    ["the note is only padding around a short word", { resolution: "accepted", note: "   abc    " }],
    ["the note is too long", { resolution: "accepted", note: "x".repeat(1001) }],
    ["the resolution is unknown", { resolution: "partial", note: NOTE }],
  ])("[resolve-dispute] rejects the request with 400 when %s", async (_label, body) => {
    const dispute = await findDispute({ status: "open" });
    const response = await resolve(dispute.id, body);
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_FAILED");
    expect((await db.dispute.findUnique({ where: { id: dispute.id } }))?.status).toBe("open");
  });

  it("[resolve-dispute] returns 404 for an unknown dispute", async () => {
    const { status, body } = await resolve("dispute_does_not_exist", { resolution: "accepted", note: NOTE });
    expect(status).toBe(404);
    expect(body.error?.code).toBe("NOT_FOUND");
  });
});
