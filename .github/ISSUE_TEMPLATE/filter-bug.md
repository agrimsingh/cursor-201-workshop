---
name: "Bug: invoice status filter is ignored"
about: "The planted bug used in step 3 of the Cursor 201 workshop"
title: "Invoice status filter is ignored: filtering by Overdue still shows every invoice"
labels: ["bug"]
---

### What happens

On **Invoices**, choosing **Status → Overdue** changes the URL to `/invoices?state=overdue`, but the table still lists every invoice, including paid, draft and void ones. The invoice count doesn't change either.

### Expected

Only overdue invoices are listed, the count shows the number of overdue invoices, and pagination applies to the filtered list.

### Steps to reproduce

1. `npm run dev` and open http://localhost:3000/invoices
2. Pick **Overdue** in the **Status** filter.
3. See paid and draft invoices still in the list.

The API filters correctly when called directly (`/api/invoices?status=overdue`), so the problem is somewhere between the page and the API.

### Tests

These already fail on `main` because of this bug:

- `tests/integration/invoices-api.test.ts`: `[filter-bug] honours the status filter sent by the invoices page`
- `e2e/invoices.spec.ts`: `[filter-bug] filters invoices by status`

### Done when

Both tests pass, `npm run lint && npm run typecheck && npm test` is green, and the fix is in a pull request that says `Fixes #<this issue>`.
