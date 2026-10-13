---
name: "Homework 9: Bad-debt write-off"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 9: Bad-debt write-off"
labels: ["homework"]
---

**Goal:** close out invoices that will never be paid.

- Admins write off the remaining balance of a 90+ invoice with a reason. This creates a credit-note-like `WriteOff` record and settles the invoice through the state machine.
- Write-offs over a threshold need a second admin to approve them (`pending_approval` → `approved` | `rejected`).
- Add write-offs to the aging report as a separate total for the last 90 days.
- **Done when:** the approval flow has a state machine with unit tests and the two-person rule is enforced in the service layer.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
