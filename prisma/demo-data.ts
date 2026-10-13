import { DEMO_USERS } from "../lib/auth/demo-users";
import { db } from "../lib/db";
import { addDays, startOfUtcDay } from "../lib/domain/dates";
import type { Actor } from "../lib/domain/permissions";
import type { Currency } from "../lib/money";
import { issueCreditNote } from "../lib/services/credit-notes";
import { openDispute, transitionDisputeStatus } from "../lib/services/disputes";
import { createInvoice, markOverdueInvoices, transitionInvoiceStatus } from "../lib/services/invoices";
import { recordPayment } from "../lib/services/payments";

// Demo data for a small design-services company. Everything is scripted relative to `now`
// and replayed through lib/services, so balances, statuses and the audit log stay consistent.

const CUSTOMERS: { key: string; name: string; email: string; currency: Currency; terms: number }[] = [
  { key: "kookaburra", name: "Kookaburra Coffee Co.", email: "accounts@kookaburra.test", currency: "AUD", terms: 30 },
  { key: "harbourside", name: "Harbourside Dental", email: "finance@harbourside.test", currency: "AUD", terms: 14 },
  { key: "southern", name: "Southern Cross Logistics", email: "ap@southerncross.test", currency: "AUD", terms: 45 },
  { key: "bondi", name: "Bondi Surf Supplies", email: "billing@bondisurf.test", currency: "AUD", terms: 30 },
  { key: "pinnacle", name: "Pinnacle Architects", email: "accounts@pinnacle.test", currency: "NZD", terms: 30 },
  { key: "fernwood", name: "Fernwood Studios", email: "hello@fernwood.test", currency: "NZD", terms: 14 },
  { key: "atlas", name: "Atlas Robotics Inc.", email: "ap@atlasrobotics.test", currency: "USD", terms: 30 },
  { key: "bluefin", name: "Blue Fin Analytics", email: "finance@bluefin.test", currency: "USD", terms: 45 },
  { key: "thames", name: "Thames Print House", email: "accounts@thamesprint.test", currency: "GBP", terms: 30 },
  { key: "moorland", name: "Moorland Outdoor Ltd", email: "ledger@moorland.test", currency: "GBP", terms: 30 },
  { key: "lumen", name: "Lumen Labs BV", email: "crediteuren@lumenlabs.test", currency: "EUR", terms: 30 },
  { key: "sakura", name: "Sakura Stationery KK", email: "keiri@sakura.test", currency: "JPY", terms: 30 },
];

// Unit prices are in minor units of the customer's currency (JPY has no minor unit).
const CATALOGUE: Record<string, { description: string; unitPriceMinor: number }> = {
  retainer: { description: "Monthly design retainer", unitPriceMinor: 650000 },
  audit: { description: "Brand and design-system audit", unitPriceMinor: 480000 },
  templates: { description: "Presentation template set", unitPriceMinor: 125000 },
  social: { description: "Social media launch kit", unitPriceMinor: 89000 },
  workshop: { description: "Workshop facilitation (per day)", unitPriceMinor: 220000 },
  seats: { description: "Asset library licence (per seat, monthly)", unitPriceMinor: 4500 },
  print: { description: "Print run: A2 posters (per 100)", unitPriceMinor: 38000 },
  motion: { description: "Motion graphics package", unitPriceMinor: 310000 },
  photo: { description: "Product photography (half day)", unitPriceMinor: 145000 },
};

type Line = [keyof typeof CATALOGUE, number];
type Fate =
  | { kind: "draft" }
  | { kind: "void" }
  | { kind: "open" }
  | { kind: "paid"; afterDays: number }
  | { kind: "partial"; afterDays: number; percent: number };

// [customer, issued N days ago, lines, fate]
const INVOICES: [string, number, Line[], Fate][] = [
  ["kookaburra", 160, [["retainer", 1]], { kind: "paid", afterDays: 25 }],
  ["kookaburra", 130, [["retainer", 1]], { kind: "paid", afterDays: 31 }],
  ["kookaburra", 100, [["retainer", 1], ["print", 3]], { kind: "open" }],
  ["kookaburra", 40, [["retainer", 1]], { kind: "open" }],
  ["kookaburra", 8, [["retainer", 1], ["social", 1]], { kind: "open" }],
  ["harbourside", 120, [["audit", 1]], { kind: "paid", afterDays: 12 }],
  ["harbourside", 75, [["templates", 2]], { kind: "partial", afterDays: 10, percent: 50 }],
  ["harbourside", 20, [["photo", 2]], { kind: "open" }],
  ["harbourside", 2, [["social", 1]], { kind: "draft" }],
  ["southern", 150, [["workshop", 3]], { kind: "paid", afterDays: 44 }],
  ["southern", 110, [["seats", 40]], { kind: "open" }],
  ["southern", 70, [["seats", 40]], { kind: "open" }],
  ["southern", 35, [["seats", 45], ["workshop", 1]], { kind: "open" }],
  ["southern", 5, [["seats", 45]], { kind: "open" }],
  ["bondi", 95, [["print", 8]], { kind: "paid", afterDays: 29 }],
  ["bondi", 60, [["motion", 1]], { kind: "open" }],
  ["bondi", 25, [["print", 5], ["social", 1]], { kind: "partial", afterDays: 6, percent: 30 }],
  ["bondi", 12, [["photo", 1]], { kind: "void" }],
  ["pinnacle", 140, [["audit", 1], ["templates", 1]], { kind: "paid", afterDays: 30 }],
  ["pinnacle", 85, [["retainer", 1]], { kind: "open" }],
  ["pinnacle", 50, [["retainer", 1]], { kind: "partial", afterDays: 20, percent: 40 }],
  ["pinnacle", 18, [["retainer", 1]], { kind: "open" }],
  ["fernwood", 66, [["motion", 1], ["photo", 1]], { kind: "open" }],
  ["fernwood", 30, [["social", 2]], { kind: "paid", afterDays: 9 }],
  ["fernwood", 3, [["templates", 1]], { kind: "draft" }],
  ["atlas", 170, [["workshop", 2], ["audit", 1]], { kind: "paid", afterDays: 28 }],
  ["atlas", 125, [["seats", 120]], { kind: "open" }],
  ["atlas", 90, [["seats", 120]], { kind: "paid", afterDays: 33 }],
  ["atlas", 45, [["seats", 130], ["motion", 1]], { kind: "open" }],
  ["atlas", 10, [["seats", 130]], { kind: "open" }],
  ["bluefin", 105, [["audit", 1]], { kind: "partial", afterDays: 40, percent: 60 }],
  ["bluefin", 55, [["templates", 3]], { kind: "open" }],
  ["bluefin", 15, [["workshop", 2]], { kind: "open" }],
  ["thames", 135, [["print", 12]], { kind: "paid", afterDays: 30 }],
  ["thames", 80, [["print", 10], ["photo", 1]], { kind: "open" }],
  ["thames", 42, [["print", 6]], { kind: "open" }],
  ["thames", 6, [["print", 4]], { kind: "draft" }],
  ["moorland", 115, [["motion", 1]], { kind: "void" }],
  ["moorland", 64, [["photo", 3], ["social", 1]], { kind: "paid", afterDays: 21 }],
  ["moorland", 28, [["retainer", 1]], { kind: "open" }],
  ["lumen", 98, [["workshop", 2]], { kind: "open" }],
  ["lumen", 48, [["templates", 2], ["social", 1]], { kind: "partial", afterDays: 15, percent: 25 }],
  ["lumen", 9, [["audit", 1]], { kind: "open" }],
  ["sakura", 92, [["print", 20]], { kind: "paid", afterDays: 30 }],
  ["sakura", 58, [["templates", 2]], { kind: "open" }],
  ["sakura", 22, [["social", 3]], { kind: "open" }],
  ["sakura", 1, [["print", 10]], { kind: "draft" }],
];

/** Runs `fn`, then back-dates any audit entries it wrote to `when`. */
async function at<T>(when: Date, fn: () => Promise<T>): Promise<T> {
  const startedAt = new Date(Date.now() - 1000);
  const result = await fn();
  await db.auditEntry.updateMany({ where: { createdAt: { gte: startedAt } }, data: { createdAt: when } });
  return result;
}

function percentOf(amountMinor: number, percent: number): number {
  return Math.floor((amountMinor * percent) / 100);
}

export async function seedDemoData(now: Date = new Date()): Promise<void> {
  const today = startOfUtcDay(now);
  const businessHours = (date: Date, hour = 10) => new Date(date.getTime() + hour * 60 * 60 * 1000);

  for (const user of DEMO_USERS) await db.user.create({ data: user });
  const agent: Actor = { id: "user_marcus", name: "Marcus Lee", role: "agent" };
  const admin: Actor = { id: "user_dana", name: "Dana Okafor", role: "admin" };

  const customerIds = new Map<string, string>();
  for (const [index, customer] of CUSTOMERS.entries()) {
    const created = await db.customer.create({
      data: {
        id: `cus_${customer.key}`,
        name: customer.name,
        email: customer.email,
        currency: customer.currency,
        paymentTermsDays: customer.terms,
        createdAt: addDays(today, -200 + index),
      },
    });
    customerIds.set(customer.key, created.id);
  }

  // Create and send invoices in issue-date order so invoice numbers follow the calendar.
  const ordered = [...INVOICES].sort((a, b) => b[1] - a[1]);
  const followUps: { when: Date; run: () => Promise<unknown> }[] = [];

  for (const [customerKey, issuedDaysAgo, lines, fate] of ordered) {
    const customer = CUSTOMERS.find((c) => c.key === customerKey)!;
    const customerId = customerIds.get(customerKey)!;
    const issueDate = addDays(today, -issuedDaysAgo);
    const dueDate = addDays(issueDate, customer.terms);
    const invoice = await at(businessHours(issueDate, 9), () =>
      createInvoice(agent, {
        customerId,
        currency: customer.currency,
        issueDate,
        dueDate,
        lines: lines.map(([item, quantity]) => ({ ...CATALOGUE[item], quantity })),
      }),
    );
    if (fate.kind === "draft") continue;
    await at(businessHours(issueDate), () => transitionInvoiceStatus(agent, invoice.id, "send", businessHours(issueDate)));
    if (fate.kind === "void") {
      const voidedAt = businessHours(addDays(issueDate, 3), 14);
      followUps.push({ when: voidedAt, run: () => transitionInvoiceStatus(admin, invoice.id, "void", voidedAt) });
    }
    if (fate.kind === "paid" || fate.kind === "partial") {
      const receivedAt = businessHours(addDays(issueDate, fate.afterDays), 11);
      const amountMinor = fate.kind === "paid" ? invoice.totalMinor : percentOf(invoice.totalMinor, fate.percent);
      followUps.push({
        when: receivedAt,
        run: () =>
          recordPayment(
            agent,
            {
              customerId,
              currency: customer.currency,
              amountMinor,
              method: customer.currency === "AUD" ? "bank_transfer" : "card",
              reference: `REM-${invoice.number.slice(-4)}`,
              receivedAt,
              allocation: { mode: "explicit", lines: [{ invoiceId: invoice.id, amountMinor }] },
            },
            receivedAt,
          ),
      });
    }
  }

  for (const followUp of followUps.sort((a, b) => a.when.getTime() - b.when.getTime())) {
    await at(followUp.when, followUp.run);
  }

  // One remittance that covers several invoices (oldest first) and leaves customer credit.
  const southernPaidAt = businessHours(addDays(today, -4), 15);
  await at(southernPaidAt, () =>
    recordPayment(
      agent,
      {
        customerId: customerIds.get("southern")!,
        currency: "AUD",
        amountMinor: 250_000,
        method: "bank_transfer",
        reference: "SCL-REMIT-0931",
        receivedAt: southernPaidAt,
        allocation: { mode: "oldest_first" },
      },
      southernPaidAt,
    ),
  );

  // An overpayment: the remainder stays on the payment as unapplied credit.
  const moorlandPaidAt = businessHours(addDays(today, -2), 12);
  await at(moorlandPaidAt, () =>
    recordPayment(
      agent,
      {
        customerId: customerIds.get("moorland")!,
        currency: "GBP",
        amountMinor: 700_000,
        method: "bank_transfer",
        reference: "MOOR-88213",
        receivedAt: moorlandPaidAt,
        allocation: { mode: "oldest_first" },
      },
      moorlandPaidAt,
    ),
  );

  // Credit notes.
  const invoicesBy = async (key: string) =>
    db.invoice.findMany({ where: { customerId: customerIds.get(key)! }, orderBy: { issueDate: "asc" } });
  const [, , kookaburraOld] = await invoicesBy("kookaburra");
  const creditAt = businessHours(addDays(today, -30), 13);
  await at(creditAt, () =>
    issueCreditNote(admin, { invoiceId: kookaburraOld.id, amountMinor: 38_000, reason: "pricing_error" }, creditAt),
  );
  const [, thamesMid] = await invoicesBy("thames");
  const goodwillAt = businessHours(addDays(today, -12), 16);
  await at(goodwillAt, () =>
    issueCreditNote(admin, { invoiceId: thamesMid.id, amountMinor: 25_000, reason: "goodwill" }, goodwillAt),
  );

  // Bring statuses up to date, as the nightly job would.
  await at(businessHours(today, 1), () => markOverdueInvoices("system", businessHours(today, 1)));

  // Disputes.
  const disputeSpecs: {
    key: string;
    index: number;
    daysAgo: number;
    reason: "pricing" | "duplicate" | "not_received" | "quality" | "other";
    percent: number;
    description: string;
    then?: "start_review" | "withdraw";
  }[] = [
    { key: "atlas", index: 1, daysAgo: 20, reason: "duplicate", percent: 100, description: "Seat licences for this period were billed twice: see INV for the same month.", then: "start_review" },
    { key: "bondi", index: 1, daysAgo: 9, reason: "quality", percent: 40, description: "Two of the five motion pieces were delivered at the wrong aspect ratio." },
    { key: "lumen", index: 0, daysAgo: 15, reason: "pricing", percent: 50, description: "Workshop was quoted at a half-day rate for the second day." },
    { key: "fernwood", index: 0, daysAgo: 25, reason: "not_received", percent: 100, description: "Customer says the photo assets never arrived.", then: "withdraw" },
  ];
  for (const spec of disputeSpecs) {
    const invoice = (await invoicesBy(spec.key)).filter((i) => i.status !== "paid" && i.status !== "void")[spec.index];
    const openedAt = businessHours(addDays(today, -spec.daysAgo), 10);
    const dispute = await at(openedAt, () =>
      openDispute(agent, {
        invoiceId: invoice.id,
        amountMinor: Math.max(1, percentOf(invoice.balanceMinor, spec.percent)),
        reason: spec.reason,
        description: spec.description,
      }),
    );
    await db.dispute.update({ where: { id: dispute.id }, data: { openedAt } });
    if (spec.then) {
      const event = spec.then;
      await at(addDays(openedAt, 2), () => transitionDisputeStatus(agent, dispute.id, event));
    }
  }
}

export async function clearDatabase(): Promise<void> {
  await db.$transaction([
    db.auditEntry.deleteMany(),
    db.paymentAllocation.deleteMany(),
    db.creditNote.deleteMany(),
    db.dispute.deleteMany(),
    db.payment.deleteMany(),
    db.invoiceLine.deleteMany(),
    db.invoice.deleteMany(),
    db.customer.deleteMany(),
    db.user.deleteMany(),
  ]);
}
