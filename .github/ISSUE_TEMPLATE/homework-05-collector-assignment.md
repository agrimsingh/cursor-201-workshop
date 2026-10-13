---
name: 'Homework 5: Collector assignment and "My queue"'
about: "Collections queue follow-up from the Cursor 201 workshop"
title: 'Homework 5: Collector assignment and "My queue"'
labels: ["homework"]
---

**Goal:** split the queue between agents.

- Add `assignedToId` to invoices (or a separate assignment table) with `POST /api/invoices/:id/assignment` (agents assign themselves; admins assign anyone).
- Add a **Mine / Unassigned / Everyone** filter to the queue, persisted in the URL.
- Auto-assign new 90+ invoices to the admin during the overdue sweep.
- **Done when:** filters are applied in the database query, not in the browser.

### How to work on it

- Start from `step-6-cloud-bugbot` and follow `docs/architecture.md` and `.cursor/rules/api-conventions.mdc`.
- Business rules go in `lib/domain/` (unit tests), writes in `lib/services/` (one audit entry per state change).
- Add integration tests for new endpoints and a Playwright test for new UI.
- Try a plan first (Plan mode), use the `create-api` skill for new endpoints, and let Bugbot review your PR.

Full list: [docs/homework.md](https://github.com/agrimsingh/cursor-201-workshop/blob/main/docs/homework.md)
