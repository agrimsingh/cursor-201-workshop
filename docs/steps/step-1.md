# Step 1: Context 60/40 (about 8 min)

**Branch when you start:** `main` · **Finished state:** `step-1-context`

## Goal

Get better answers by giving the agent the right context, not all of it. You'll compare a "whole app" chat with an @-scoped chat, look at how much of the context window each one uses, and then reuse an earlier chat with `@Chats` instead of explaining everything again.

The rule of thumb behind the name: spend most of your effort (about 60%) choosing context and describing the change, and let the agent spend the rest writing it.

## Open in Cursor

- The repo folder (`cursor .` or **File → Open Folder**).
- The **Agent** chat (`Cmd+I` / `Ctrl+I`).
- `docs/architecture.md`: skim it. It's written to be attached as context.
- The app at http://localhost:3000/invoices (already running from setup; if not, run `npm run dev`).

## Do it

### 1. A whole-app chat

Start a **new chat** in **Ask** mode (mode picker under the input, or `Shift+Tab`). Don't attach anything:

```text
How does Tally work? Walk me through how an invoice becomes overdue and how the invoices list page gets its data.
```

When it finishes, hover or click the **context ring** next to the prompt input. Note how full it is and which categories are using it (conversation, tools, and so on). The agent had to search and read files to find its way around.

### 2. An @-scoped chat

Start **another new chat**, switch to **Agent** mode, and attach exactly the files the change needs. Type `@` and pick each file:

```text
@docs/architecture.md @lib/domain/aging.ts @lib/domain/invoice-status.ts @lib/services/invoices.ts @components/invoices/invoice-list.tsx

Add a "Days late" column to the invoices list, right after "Due". It does not need to be sortable.
- Compute it on the server in listInvoices as a new `daysPastDue` field on InvoiceListItem, using daysPastDue() from lib/domain/aging.ts.
- Open invoices (isOpenInvoice: sent, partially_paid, overdue) get the whole days past due, never negative. Everything else, including invoices that are not due yet, is 0.
- In the table, show "—" for 0, and colour 61+ days in rose so it stands out.
Keep money and date handling as it is.
```

Compare the context ring with chat 1. The scoped chat should start much leaner, because the agent didn't have to go looking.

### 3. Reuse the chat with @Chats

Start a **third new chat**. Type `@Chats`, pick the chat from part 2, and ask for the follow-up without re-explaining:

```text
@Chats <the "Days late" chat>

Add an integration test to tests/integration/invoices-api.test.ts that checks daysPastDue is greater than 0 for overdue invoices and exactly 0 for paid ones. Query GET /api/invoices with ?status=overdue and ?status=paid directly, like the "filters by ?status=" test (not through toInvoiceSearchParams, which has a known bug). Run npm run test:integration and show me the result.
```

## What you should see

- A new **Days late** column on http://localhost:3000/invoices, with numbers on overdue rows and "—" everywhere else (paid, draft, void and not-yet-due invoices).
- The scoped chat used noticeably less context than the whole-app chat.
- The third chat knew what `daysPastDue` was without you explaining it.

## Check it worked

```bash
npm run test:integration
```

Your new `daysPastDue` test passes. One integration test still fails: `[filter-bug] honours the status filter sent by the invoices page` (its e2e twin in `e2e/invoices.spec.ts` fails too). That bug is deliberate; you'll fix it in step 3.

## Catch up

If you have local edits, put them aside first with `git stash` (or discard them with `git checkout -- . && git clean -fd`).

```bash
git checkout step-1-context
npm install && npx prisma generate && npx prisma db seed
```

## Try it yourself

- Ask the same question as part 1 with only `@docs/architecture.md` attached. How close does the answer get, and how much context does it use?
- Add a **Days late** sort option (`sort=daysPastDue`). Which files do you need to @-mention? Hint: it can't be a plain column sort, because it's derived from `dueDate`.
- Try `@Chats` to summarise a long chat into a short brief, then start the next task from that brief.
