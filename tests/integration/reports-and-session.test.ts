import { beforeAll, describe, expect, it } from "vitest";
import { GET as getAudit } from "@/app/api/audit/route";
import { GET as getAging } from "@/app/api/reports/aging/route";
import { GET as getSession, PUT as switchUser } from "@/app/api/session/route";
import { SESSION_COOKIE } from "@/lib/auth/demo-users";
import { db } from "@/lib/db";
import { AGING_BUCKETS, type AgingReport } from "@/lib/domain/aging";
import { callRoute, NOW, resetDatabase, viewer } from "./helpers";

beforeAll(resetDatabase);

describe("GET /api/reports/aging", () => {
  it("buckets every open balance exactly once, per currency", async () => {
    const { body } = await callRoute<Record<string, never>, { data: AgingReport }>(getAging, {
      path: "/api/reports/aging",
      query: { asOf: NOW.toISOString() },
    });
    const open = await db.invoice.groupBy({
      by: ["currency"],
      where: { status: { in: ["sent", "partially_paid", "overdue"] }, balanceMinor: { gt: 0 } },
      _sum: { balanceMinor: true },
    });
    for (const row of open) {
      const currency = body.data.currencies.find((c) => c.currency === row.currency)!;
      expect(currency.totalMinor).toBe(row._sum.balanceMinor);
      expect(AGING_BUCKETS.reduce((sum, bucket) => sum + currency.buckets[bucket], 0)).toBe(currency.totalMinor);
    }
    expect(body.data.currencies.some((c) => c.buckets["90+"] > 0)).toBe(true);
  });
});

describe("session and audit access", () => {
  it("reports the current user's capabilities", async () => {
    const { body } = await callRoute<Record<string, never>, { data: { role: string; capabilities: string[] } }>(getSession, {
      path: "/api/session",
      as: viewer,
    });
    expect(body.data).toMatchObject({ role: "viewer", capabilities: [] });
  });

  it("switches user with a cookie", async () => {
    const { status, headers } = await callRoute(switchUser, { method: "PUT", path: "/api/session", body: { userId: "user_dana" } });
    expect(status).toBe(200);
    expect(headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=user_dana`);
  });

  it("rejects unknown users", async () => {
    const { status } = await callRoute(switchUser, { method: "PUT", path: "/api/session", body: { userId: "user_nobody" } });
    expect(status).toBe(404);
  });

  it("hides the audit log from viewers", async () => {
    expect((await callRoute(getAudit, { path: "/api/audit", as: viewer })).status).toBe(403);
    const { status, body } = await callRoute<Record<string, never>, { data: unknown[] }>(getAudit, { path: "/api/audit" });
    expect(status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
