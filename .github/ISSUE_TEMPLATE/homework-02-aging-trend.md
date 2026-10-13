---
name: "Homework 2: Aging trend snapshots"
about: "Collections queue follow-up from the Cursor 201 workshop"
title: "Homework 2: Aging trend snapshots"
labels: ["homework"]
---

**Goal:** see whether collections are getting better or worse over time.

- Add an `AgingSnapshot` model that stores the bucket totals per currency for a date. Add `POST /api/reports/aging/snapshots` (admin, idempotent per day) and `GET /api/reports/aging/trend?currency=AUD&days=90`.
- Seed 12 weekly snapshots. Show a small trend chart (plain SVG or CSS bars, no chart library) on the Collections page.
- **Done when:** snapshots never add currencies together and re-running the same day replaces rather than duplicates.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
