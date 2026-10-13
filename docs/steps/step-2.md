# Step 2: Rules and skills (about 10 min)

**Branch when you start:** `step-1-context` · **Finished state:** `step-2-rules-skills`

Part 3 is the longest: the agent writes domain code, a schema, a service, a route, tests and docs. Start it as soon as the skill exists.

## Goal

Teach Cursor your team's conventions once, instead of repeating them in every prompt.

- A **rule** (`.cursor/rules/*.mdc`) is guidance that gets attached automatically, here whenever the agent works on API code.
- A **skill** (`.cursor/skills/<name>/SKILL.md`) is a repeatable procedure the agent can follow, or that you run with `/<skill-name>`.

You'll create an API conventions rule with `/create-rule`, a `create-api` skill with `/create-skill`, and then use the skill to add a new endpoint.

## Open in Cursor

- `app/api/invoices/route.ts` and `app/api/payments/route.ts`: what a good handler looks like.
- `lib/http/route.ts`, `lib/http/errors.ts`, `lib/validation/`, `lib/services/payments.ts`.
- A new **Agent** chat.

## Do it

### 1. Create the rule

In a new Agent chat:

```text
/create-rule API conventions for Tally. Apply it to app/api/**, lib/services/**, lib/validation/** and lib/domain/**.

Route handlers:
- wrap every handler in handle() from lib/http/route.ts; no try/catch in handlers
- parse every input (params, query string, body) with a zod schema from lib/validation using parseParams / parseQuery / parseJson
- when the service needs to check a permission (every write), get the current user with actorFromRequest and pass it in
- call exactly one function in lib/services and return ok(), created() or okList()
- errors always use the { "error": { "code", "message", "details"? } } shape from lib/http/errors.ts: throw NotFoundError, DomainError or ApiError and let handle() render them; never hand-roll error JSON

Data access and business rules:
- only lib/services may touch the database, and only by importing `db` from lib/db.ts; never import `db` or the generated Prisma client in app/ or components/, and never construct a PrismaClient
- services check permissions with assertCan, run writes inside db.$transaction, and call recordAudit for every state change
- business rules (state transitions, amounts, guards) live in lib/domain as pure functions
- money is always integer minor units plus a currency code; never floats

Save it as .cursor/rules/api-conventions.mdc
```

Open the new `.cursor/rules/api-conventions.mdc`. Check the frontmatter: it should have a `description`, `globs` for the four folders, and `alwaysApply: false`.

### 2. Create the skill

In the same chat (or a new one):

```text
/create-skill create-api: a project skill for adding a new HTTP endpoint to Tally that follows .cursor/rules/api-conventions.mdc.

Steps the skill should walk through:
1. Read docs/architecture.md and the closest existing route for reference.
2. Put any pure business logic in lib/domain with unit tests in tests/unit.
3. Add zod schemas for params, query and body in lib/validation.
4. Add a service function in lib/services (assertCan for permissions; db.$transaction and recordAudit for writes).
5. Add the route handler in app/api using handle(), the parse helpers and ok()/created()/okList().
6. Add integration tests in tests/integration using the callRoute helper: happy path, validation error, not found, and role checks (403 for a role without the capability, or that viewers can read).
7. Add the endpoint to the API table in docs/architecture.md.
8. Run npm run lint, npm run typecheck and npm test.

Save it as a project skill at .cursor/skills/create-api/SKILL.md
```

If Cursor saved the skill under `~/.cursor/skills/create-api/` (your personal skills) instead, promote it to a project skill so everyone who clones the repo gets it. Move the folder (in your file manager, or on macOS and Linux):

```bash
mkdir -p .cursor/skills && mv ~/.cursor/skills/create-api .cursor/skills/create-api
```

Run that only if `.cursor/skills/create-api` doesn't exist yet; otherwise `mv` nests the folders.

### 3. Use the skill to build an endpoint

Start a **new chat** so you can see the rule and skill doing the work:

```text
/create-api GET /api/customers/:id/statement

A customer statement for one currency (query param `currency`, defaulting to the customer's billing currency). Only include records in that currency.
- Invoices in any status except draft and void are debits at their issue date (totalMinor). Leave out credit notes on voided invoices.
- Payments are credits at their received date, using each payment's full amountMinor (unapplied credit reduces what the customer owes).
- Credit notes are credits at their issue date.
- Sort by date and give each line a running balance.
- Response: { customer: { id, name }, currency, lines: [{ date, kind, reference, debitMinor, creditMinor, balanceMinor }], closingBalanceMinor }
Anyone, including viewers, can read it. Unknown customer is a 404. An unsupported currency is a 400; a supported currency with no activity returns an empty statement.
```

## What you should see

- `.cursor/rules/api-conventions.mdc` and `.cursor/skills/create-api/SKILL.md` in the repo.
- When the agent edits files under `app/api/`, the rule shows up in the context ring breakdown under **Rules**.
- The agent follows the skill: a statement builder in `lib/domain/`, a schema, a service, the route, integration tests, and a new row in `docs/architecture.md`.

## Check it worked

With `npm run dev` still running:

```bash
npm test
npm run validate:cursor
curl -s http://localhost:3000/api/customers/cus_kookaburra/statement | head -c 400
```

The new statement tests pass, `validate:cursor` confirms the rule and skill frontmatter, and the only failing test is still `[filter-bug] ...`.

## Catch up

If you have local edits, put them aside first with `git stash` (or discard them with `git checkout -- . && git clean -fd`).

```bash
git checkout step-2-rules-skills
npm install && npx prisma generate && npx prisma db seed
```

## Try it yourself

- Ask the agent to add `GET /api/credit-notes` with **no** extra instructions. Does it follow the rule without being told?
- Add a second rule for UI code (`components/**`): client components call the API with `apiRequest` and then `router.refresh()`, and never import from `lib/services`.
- Change the rule to `alwaysApply: true` and compare the context ring in an unrelated chat. Scoping rules with `globs` keeps them out of the way when they aren't relevant.
