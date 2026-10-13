# Step 5: Parallelizing with subagents (about 12 min)

**Branch when you start:** `step-4-models` · **Finished state:** `step-5-multitask`

## Goal

Build a real feature, **Resolve a dispute**, by splitting it into three workstreams that run at the same time in separate worktrees. You'll track them on a live Canvas and finish with a reviewer subagent that checks the combined change against the project rules.

The plan is already written: [`.cursor/plans/resolve-dispute.md`](../../.cursor/plans/resolve-dispute.md). Read the **Behaviour** table and the **Step 0: shared contract** section first. Freezing the contract before fanning out is what lets three agents work in parallel without stepping on each other.

| Workstream | Owns |
| --- | --- |
| A: API + Prisma | domain transition, service, `POST /api/disputes/:id/resolve` (the Prisma change is step 0) |
| B: UI | resolve dialog and resolution summary on `/disputes/[id]` |
| C: tests + audit | unit, integration and e2e tests tagged `[resolve-dispute]`, and the audit trail entry |

## Open in Cursor

- `.cursor/plans/resolve-dispute.md`
- `.cursor/worktrees.json`: each new worktree runs `npm ci`, `npx prisma generate` and `npx prisma db seed`, so every subagent gets its own working copy and its own database.
- The **Agents Window** works well here, because you can see each agent and its worktree side by side.

## Do it

### 1. Add the reviewer and verifier subagents

Create two project subagents (or copy them from the `step-5-multitask` branch: `git checkout origin/step-5-multitask -- .cursor/agents`):

```text
Create two project subagents in .cursor/agents/:

1. reviewer.md: name "reviewer", readonly: true. A code reviewer for Tally. It reviews the current diff against .cursor/rules/api-conventions.mdc and docs/architecture.md: money in integer minor units, state changes only through lib/domain state machines, assertCan + db.$transaction + recordAudit in services, zod at every API boundary, the standard error shape, no Prisma outside lib/services, tests for new behaviour. It reports findings as Blocker / Should fix / Nit with file:line and a suggested fix, and never edits files.

2. verifier.md: name "verifier". It validates completed work: it is skeptical, runs npm run lint, npm run typecheck, npm test and npm run test:e2e, checks each acceptance criterion in the plan it is given, and reports what passed, what failed and what is missing.
```

### 2. Fan out with /multitask

Start a new **Agent** chat:

```text
/multitask Implement @.cursor/plans/resolve-dispute.md

1. Do "Step 0: shared contract" yourself first and commit it.
2. Then run workstreams A, B and C as three parallel subagents, each in its own git worktree, each starting from the contract commit. Give each subagent only its own section of the plan plus the contract.
3. While they run, keep a Canvas showing each workstream's status, current task, files touched and test results. Update it as they report back.
4. When all three are done, merge them into this branch in the order A, then B, then C, and run npm run lint, npm run typecheck, npm test and npm run test:e2e.
5. Ask the reviewer subagent to review the combined diff and the verifier subagent to check the plan's behaviour table. Fix any Blocker or Should-fix findings.
```

Alternatives: open the plan, click **Build in Parallel**, or use `/canvas` to ask for the status board yourself.

### 3. Try it in the app

Switch to **Dana Okafor (admin)** in the header, open **Disputes**, open an active dispute and click **Resolve dispute**. Accept it and check that the invoice gets a credit note and a lower balance. Reject another one and check that its invoice is back on the **Collections** page.

## What you should see

- A contract commit, then three subagents working at the same time in their own worktrees.
- A Canvas with three columns (A, B, C) that updates as each subagent reports back.
- A merged branch with `POST /api/disputes/:id/resolve`, a **Resolve dispute** dialog for admins, a **Resolution** section on resolved disputes, "Dispute resolved" entries in the history, and `[resolve-dispute]` tests.
- A reviewer report grouped by severity, and a verifier report that ticks off the behaviour table.

## Check it worked

```bash
npm test             # includes the [resolve-dispute] unit and integration tests
npm run test:e2e     # includes e2e/resolve-dispute.spec.ts
```

As **Marcus Lee (agent)**, the **Resolve dispute** button is not shown, and the API returns `403`.

## Catch up

If you have local edits, put them aside first with `git stash` (or discard them with `git checkout -- . && git clean -fd`).

```bash
git checkout step-5-multitask
npm install && npx prisma generate && npx prisma db seed
```

The schema changed in this step, so re-run the seed whenever you switch to or from this branch.

## Try it yourself

- Run the same plan without step 0 (let each workstream invent its own types) and compare how much merging that costs.
- Give the reviewer a different model from the parent (`model:` in its frontmatter) and compare the findings.
- Add a fourth workstream: an "Accepted disputes this month" card on the dashboard, built in parallel with a second plan.
