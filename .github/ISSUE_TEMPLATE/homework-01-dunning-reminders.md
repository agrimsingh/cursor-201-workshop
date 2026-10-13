---
name: "Homework 1: Dunning reminder schedule"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 1: Dunning reminder schedule"
labels: ["homework"]
---

**Goal:** turn "Send reminder" into a real, auditable reminder history.

- Add a `Reminder` model (invoice, level, sentAt, sentBy, channel `email`) and a dunning policy in `lib/domain/dunning.ts`: level 1 at 3 days late, level 2 at 14, level 3 (final notice) at 30.
- `POST /api/invoices/:id/reminders` records the next reminder level. It refuses to skip levels or to remind for invoices that are on hold, paid or void.
- Show the reminder history on the invoice page and the last reminder in the queue. Render a plain-text email preview (no sending).
- **Done when:** the policy is unit tested, the endpoint has integration tests (including role checks), and each reminder writes an audit entry.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
