# Homework: grow the Collections queue

Nine follow-up tasks that build on Tally's Collections queue (`/collections`, `lib/domain/aging.ts`, `lib/services/reports.ts`). Each one is sized for a single session with Cursor and touches several layers, so it's a good place to practise what the workshop covered: scoped context, the `create-api` skill, plans, parallel subagents, cloud agents and Bugbot.

Start from the finished branch:

```bash
git checkout step-6-cloud-bugbot
npm install && npx prisma generate && npx prisma db seed
```

Each task is also available as a GitHub issue template (**Issues → New issue** on your fork) labelled `homework`. For every task:

- follow `.cursor/rules/api-conventions.mdc` and `docs/architecture.md`;
- put business rules in `lib/domain/` with unit tests, and writes in `lib/services/` with an audit entry;
- add integration tests for new endpoints and a Playwright test for new UI flows;
- open a PR and let Bugbot review it.

---

## 1. Dunning reminder schedule

**Goal:** turn "Send reminder" into a real, auditable reminder history.

- Add a `Reminder` model (invoice, level, sentAt, sentBy, channel `email`) and a dunning policy in `lib/domain/dunning.ts`: level 1 at 3 days late, level 2 at 14, level 3 (final notice) at 30.
- `POST /api/invoices/:id/reminders` records the next reminder level. It refuses to skip levels or to remind for invoices that are on hold, paid or void.
- Show the reminder history on the invoice page and the last reminder in the queue. Render a plain-text email preview (no sending).
- **Done when:** the policy is unit tested, the endpoint has integration tests (including role checks), and each reminder writes an audit entry.

## 2. Aging trend snapshots

**Goal:** see whether collections are getting better or worse over time.

- Add an `AgingSnapshot` model that stores the bucket totals per currency for a date. Add `POST /api/reports/aging/snapshots` (admin, idempotent per day) and `GET /api/reports/aging/trend?currency=AUD&days=90`.
- Seed 12 weekly snapshots. Show a small trend chart (plain SVG or CSS bars, no chart library) on the Collections page.
- **Done when:** snapshots never add currencies together and re-running the same day replaces rather than duplicates.

## 3. Promise to pay

**Goal:** record when a customer promises to pay, and flag broken promises.

- Add a `PaymentPromise` model (invoice, amountMinor, promisedFor, recordedBy, status `pending` | `kept` | `broken`).
- Agents record a promise from the queue. Pending promises move the invoice to a **Promised** section of the queue until the date passes.
- Payments that cover the promised amount mark the promise `kept`. The overdue sweep marks expired promises `broken` and puts the invoice back in the queue with a "Broken promise" flag.
- **Done when:** the promise state machine lives in `lib/domain/` with unit tests and every transition is audited.

## 4. Bulk actions on the queue

**Goal:** work the queue faster.

- Add checkboxes and a bulk action bar to the queue: **Send reminder**, **Assign to me**, **Snooze 7 days** (combine with tasks 1, 5 and 6, or stub the ones you haven't built).
- `POST /api/collections/bulk` accepts up to 100 invoice ids and an action, runs it per invoice in a transaction, and returns per-invoice success or error, so one bad row doesn't fail the batch.
- **Done when:** partial failures are reported in the UI and covered by integration tests.

## 5. Collector assignment and "My queue"

**Goal:** split the queue between agents.

- Add `assignedToId` to invoices (or a separate assignment table) with `POST /api/invoices/:id/assignment` (agents assign themselves; admins assign anyone).
- Add a **Mine / Unassigned / Everyone** filter to the queue, persisted in the URL.
- Auto-assign new 90+ invoices to the admin during the overdue sweep.
- **Done when:** filters are applied in the database query, not in the browser.

## 6. Snooze and next follow-up date

**Goal:** stop chasing the same customer every day.

- Add `nextFollowUpAt` to invoices. Agents snooze an invoice for 1, 3, 7 or 14 days with a required note.
- Snoozed invoices drop out of the queue until the date and show a "Snoozed until" chip on the invoice page.
- **Done when:** snoozing an invoice that is paid, void or on hold fails with `422 BUSINESS_RULE`.

## 7. Priority score

**Goal:** sort the queue by risk, not just age.

- Write `scoreQueueItem()` in `lib/domain/aging.ts`: combine days late, balance (normalised per currency), number of previous disputes and broken promises (if task 3 exists).
- Sort the queue by score with an explanation tooltip ("90+ days, 3 invoices overdue, disputed before").
- **Done when:** the scoring function is pure, deterministic and unit tested with a table of cases.

## 8. Credit hold

**Goal:** stop sending new work to customers who are seriously late.

- A customer with any balance in the 90+ bucket (or above a configurable per-currency limit) is **on credit hold**.
- Sending a new invoice to a customer on hold requires an admin override with a reason. Agents get `422 BUSINESS_RULE`.
- Show a credit hold banner on the customer page and in the invoice send flow.
- **Done when:** the hold rule is in `lib/domain/`, the override is audited, and both paths have tests.

## 9. Bad-debt write-off

**Goal:** close out invoices that will never be paid.

- Admins write off the remaining balance of a 90+ invoice with a reason. This creates a credit-note-like `WriteOff` record and settles the invoice through the state machine.
- Write-offs over a threshold need a second admin to approve them (`pending_approval` → `approved` | `rejected`).
- Add write-offs to the aging report as a separate total for the last 90 days.
- **Done when:** the approval flow has a state machine with unit tests and the two-person rule is enforced in the service layer.
