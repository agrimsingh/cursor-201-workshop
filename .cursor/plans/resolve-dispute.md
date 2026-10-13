---
name: Resolve a dispute
overview: Let an admin resolve an active dispute by accepting it (credit note for the disputed amount) or rejecting it (invoice returns to collections), with a full audit trail. Built as a shared contract plus three parallel workstreams.
todos:
  - id: contract
    content: "Step 0 (lead agent, before fanning out): land the shared contract"
    status: completed
  - id: workstream-a
    content: "Workstream A: domain transition, service and POST /api/disputes/:id/resolve"
    status: completed
  - id: workstream-b
    content: "Workstream B: Resolve dialog and resolution summary on the dispute page"
    status: completed
  - id: workstream-c
    content: "Workstream C: unit, integration and e2e tests plus the audit trail entry"
    status: completed
  - id: merge-review
    content: "Merge A, then B, then C; run the reviewer and verifier subagents"
    status: completed
---

# Resolve a dispute

## Why

Today a dispute can only be opened, reviewed or withdrawn (`lib/domain/dispute-status.ts`). Disputed invoices sit on hold forever, so they drop out of the collections queue and never get credited or chased. Finance needs to close the loop.

## Behaviour

An **admin** resolves an `open` or `under_review` dispute with one of two outcomes and a note:

| Outcome | Meaning | Effect |
| --- | --- | --- |
| `accepted` | The customer is right. | Issue a credit note (reason `dispute_settlement`) for `min(dispute.amountMinor, invoice balance)` and link it to the dispute. The invoice settles through the normal state machine (it may become `paid`). If the balance is already 0, no credit note is issued. |
| `rejected` | The invoice stands. | No money moves. The dispute is no longer active, so the invoice goes back into the collections queue. |

In both cases the dispute moves to `resolved`, records who resolved it, when, the outcome and the note, and writes a `dispute.resolved` audit entry with before and after snapshots. Everything happens in one transaction. Resolving a dispute that is `withdrawn` or already `resolved` fails with `409 INVALID_TRANSITION`. Agents and viewers get `403 FORBIDDEN`.

## Step 0: shared contract (lead agent, do this first)

Land this as one small commit **before** starting the workstreams, so all three build against the same types. Then run `npx prisma generate && npx prisma db seed`.

1. `prisma/schema.prisma`
   - `Dispute`: add `resolution String?` (`accepted` | `rejected`), `resolutionNote String?`, `resolvedAt DateTime?`, `resolvedById String?` and `resolvedBy User? @relation("DisputeResolvedBy", fields: [resolvedById], references: [id])`. Name the existing opener relation `@relation("DisputeOpenedBy")` and give `User` both back-relations (`disputesOpened`, `disputesResolved`).
   - `CreditNote`: add `disputeId String? @unique` and `dispute Dispute? @relation(fields: [disputeId], references: [id])`; add `creditNote CreditNote?` on `Dispute`.
2. `lib/domain/dispute-status.ts`: add `"resolved"` to `DISPUTE_STATUSES` (with an empty transitions entry for now), and export `DISPUTE_RESOLUTIONS = ["accepted", "rejected"] as const` and `type DisputeResolution`.
3. `lib/domain/permissions.ts`: add the `"disputes:resolve"` capability, granted to `admin` only.
4. `lib/domain/audit.ts`: add `"dispute.resolved"` to `AUDIT_ACTIONS` with the label `"Dispute resolved"`.
5. `lib/validation/disputes.ts`: export `resolveDisputeSchema = z.object({ resolution: z.enum(DISPUTE_RESOLUTIONS), note: z.string().trim().min(5).max(1000) })` and `type ResolveDisputeInput`.
6. `lib/services/disputes.ts#getDisputeDetail`: also include `resolvedBy: { select: { name: true } }` and `creditNote: true`.

### API contract

```
POST /api/disputes/:id/resolve
{ "resolution": "accepted" | "rejected", "note": "string, 5-1000 chars" }

200 { "data": { "dispute": Dispute, "creditNote": CreditNote | null } }
400 VALIDATION_FAILED   403 FORBIDDEN   404 NOT_FOUND   409 INVALID_TRANSITION
```

## Workstream A: API + Prisma (domain, service, route)

Owns: `lib/domain/dispute-status.ts`, `lib/services/disputes.ts`, `lib/services/credit-notes.ts`, `app/api/disputes/[id]/resolve/route.ts`. (The Prisma change is step 0.)

1. Domain: add a `resolve` event (`open` and `under_review` → `resolved`) to the transition table, and a pure `planDisputeResolution({ resolution, disputedMinor, invoiceBalanceMinor })` that returns `{ creditNoteMinor }` (0 for `rejected` or a zero balance).
2. Credit notes: extract the body of `issueCreditNote` into an exported helper that runs inside an existing transaction (for example `createCreditNoteInTx(tx, actor, input, asOf)`), and keep `issueCreditNote` as a thin wrapper.
3. Service: `resolveDispute(actor, id, input, asOf = new Date())` in `lib/services/disputes.ts`: `assertCan(actor, "disputes:resolve")`, then in one `db.$transaction` load the dispute and invoice, transition, plan, create the linked credit note if needed (reason `dispute_settlement`), update the dispute (`status`, `resolution`, `resolutionNote`, `resolvedAt`, `resolvedById`), and `recordAudit(tx, { action: "dispute.resolved", ... })` with before/after snapshots that include `status`, `resolution` and `creditNoteId`.
4. Route: `app/api/disputes/[id]/resolve/route.ts`, following the conventions of the other handlers (`handle`, `parseParams`, `parseJson(resolveDisputeSchema)`, `actorFromRequest`, `ok`).

Done when: `npm run typecheck` and `npm run lint` pass and the endpoint behaves as in the contract (try it with `curl` or a quick integration test).

## Workstream B: UI (resolve dialog on the dispute page)

Owns: `components/disputes/resolve-dispute-dialog.tsx` (new), `app/disputes/[id]/page.tsx`, `components/disputes/dispute-actions.tsx`.

1. A **Resolve dispute** button on `/disputes/[id]`, shown only to users with `disputes:resolve` and only while the dispute is active.
2. A dialog (reuse `components/ui/dialog.tsx`) titled "Resolve dispute" with two radio options, labelled **Accept: credit {amount}** and **Reject: invoice stands**, a required **Resolution note** textarea, and a **Resolve** submit button. Show the API error message inline (`FormError`) if it fails. On success, `router.refresh()`.
3. When the dispute is `resolved`, show a **Resolution** section: outcome, note, resolved by, resolved at, and a link to the invoice (where the credit note appears).

Done when: an admin can resolve from the UI, agents don't see the button, and lint and typecheck pass.

## Workstream C: tests + audit log entry

Owns: `tests/unit/dispute-status.test.ts`, `tests/integration/resolve-dispute.test.ts` (new), `e2e/resolve-dispute.spec.ts` (new), `components/audit/audit-trail.tsx`, `app/audit/page.tsx`.

Prefix every new test name with `[resolve-dispute]` (the workshop's verify script looks for it).

1. Unit: the `resolve` transition from each status, and `planDisputeResolution` (accepted, rejected, disputed amount larger than the balance, zero balance).
2. Integration (`callRoute` helper, throwaway DB):
   - accepted → `200`, dispute `resolved`, credit note linked with the right amount, invoice balance reduced, invoice status settled;
   - rejected → no credit note and the invoice is back in `GET /api/collections`;
   - the `dispute.resolved` audit entry has the admin as actor and before/after snapshots;
   - agent → `403`; resolving twice or a withdrawn dispute → `409`; missing note → `400`.
3. E2E: as Dana Okafor (admin), open an active dispute, resolve it as accepted, and see the `Resolved` badge, the resolution note and "Dispute resolved" in the history.
4. Audit trail: make `components/audit/audit-trail.tsx` describe resolutions (for example "Under review → Resolved (accepted)"), and show `resolution` in the `/audit` before/after summary.

Done when: `npm test` and `npm run test:e2e` pass after A and B are merged.

## Merge and review

1. Merge A, then B, then C into one branch. Resolve conflicts in favour of the contract.
2. Run `npm run lint && npm run typecheck && npm test && npm run test:e2e`.
3. Ask the `reviewer` subagent to review the combined diff against `.cursor/rules/` and `docs/architecture.md`, and the `verifier` subagent to confirm the behaviour table above actually holds.
4. Update `docs/architecture.md` (disputes section and API table).
