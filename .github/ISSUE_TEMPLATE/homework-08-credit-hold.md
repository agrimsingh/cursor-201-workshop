---
name: "Homework 8: Credit hold"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 8: Credit hold"
labels: ["homework"]
---

**Goal:** stop sending new work to customers who are seriously late.

- A customer with any balance in the 90+ bucket (or above a configurable per-currency limit) is **on credit hold**.
- Sending a new invoice to a customer on hold requires an admin override with a reason. Agents get `422 BUSINESS_RULE`.
- Show a credit hold banner on the customer page and in the invoice send flow.
- **Done when:** the hold rule is in `lib/domain/`, the override is audited, and both paths have tests.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
