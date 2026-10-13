---
name: "Homework 7: Priority score"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 7: Priority score"
labels: ["homework"]
---

**Goal:** sort the queue by risk, not just age.

- Write `scoreQueueItem()` in `lib/domain/aging.ts`: combine days late, balance (normalised per currency), number of previous disputes and broken promises (if task 3 exists).
- Sort the queue by score with an explanation tooltip ("90+ days, 3 invoices overdue, disputed before").
- **Done when:** the scoring function is pure, deterministic and unit tested with a table of cases.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
