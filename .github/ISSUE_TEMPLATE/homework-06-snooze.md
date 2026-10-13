---
name: "Homework 6: Snooze and next follow-up date"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 6: Snooze and next follow-up date"
labels: ["homework"]
---

**Goal:** stop chasing the same customer every day.

- Add `nextFollowUpAt` to invoices. Agents snooze an invoice for 1, 3, 7 or 14 days with a required note.
- Snoozed invoices drop out of the queue until the date and show a "Snoozed until" chip on the invoice page.
- **Done when:** snoozing an invoice that is paid, void or on hold fails with `422 BUSINESS_RULE`.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
