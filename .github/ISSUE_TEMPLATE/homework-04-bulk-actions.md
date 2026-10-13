---
name: "Homework 4: Bulk actions on the queue"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 4: Bulk actions on the queue"
labels: ["homework"]
---

**Goal:** work the queue faster.

- Add checkboxes and a bulk action bar to the queue: **Send reminder**, **Assign to me**, **Snooze 7 days** (combine with tasks 1, 5 and 6, or stub the ones you haven't built).
- `POST /api/collections/bulk` accepts up to 100 invoice ids and an action, runs it per invoice in a transaction, and returns per-invoice success or error, so one bad row doesn't fail the batch.
- **Done when:** partial failures are reported in the UI and covered by integration tests.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
