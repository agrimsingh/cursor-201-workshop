---
name: "Homework 3: Promise to pay"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 3: Promise to pay"
labels: ["homework"]
---

**Goal:** record when a customer promises to pay, and flag broken promises.

- Add a `PaymentPromise` model (invoice, amountMinor, promisedFor, recordedBy, status `pending` | `kept` | `broken`).
- Agents record a promise from the queue. Pending promises move the invoice to a **Promised** section of the queue until the date passes.
- Payments that cover the promised amount mark the promise `kept`. The overdue sweep marks expired promises `broken` and puts the invoice back in the queue with a "Broken promise" flag.
- **Done when:** the promise state machine lives in `lib/domain/` with unit tests and every transition is audited.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
