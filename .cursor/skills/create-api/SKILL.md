---
name: create-api
description: Adds a new HTTP endpoint to Tally (Next.js App Router + Prisma) end to end - domain logic, zod schema, service, route handler, integration tests and the docs API table - following .cursor/rules/api-conventions.mdc. Use when asked to add, build or scaffold an API route or endpoint under app/api, or when the user runs /create-api METHOD /api/path.
---

# Create a Tally API endpoint

Input: an HTTP method, a path such as `/api/customers/:id/statement`, and a description of the behaviour. Work through the steps in order. Follow `.cursor/rules/api-conventions.mdc` throughout; read it now if it isn't already in context.

## 1. Understand before writing

- Read `docs/architecture.md` (layers, money, roles, the error code table and the API table).
- Read the closest existing route and its service, for example:
  - read one record: `app/api/customers/[id]/route.ts` → `lib/services/customers.ts`
  - list with a query string: `app/api/invoices/route.ts` → `lib/services/invoices.ts#listInvoices`
  - write: `app/api/payments/route.ts` → `lib/services/payments.ts#recordPayment`
- Check the Prisma models you need in `prisma/schema.prisma`.
- Decide and write down: the capability needed (`lib/domain/permissions.ts`; reads usually need none), the error cases and their codes, and the response shape. If the request is ambiguous, state your assumption and carry on.

## 2. Pure logic in `lib/domain`

- Put calculations, state transitions and guards in a pure function in `lib/domain/<topic>.ts`: plain inputs, no Prisma, no Next.js, no `new Date()` (take `asOf`), and throw `DomainError` for broken rules.
- Money stays integer minor units with a currency code; use `sumMinor` from `lib/money.ts` where it helps.
- Add `tests/unit/<topic>.test.ts` (Vitest, no database): normal case, edge cases (empty input, ties, zero amounts) and each guard.
- Skip this step only when the endpoint is a plain read with no logic.

## 3. Schemas in `lib/validation`

- Add schemas for params, query and body to the resource's file in `lib/validation/` (create one if needed).
- Reuse `lib/validation/common.ts`: `idParamsSchema`, `currencySchema`, `dateSchema`, `positiveMinorSchema`, `pageSchema`, `pageSizeSchema`, `optionalQueryString`.
- Query values arrive as strings: use `z.coerce` for numbers and `.optional()` for optional values.
- Export `type XInput = z.infer<typeof xSchema>` for the service signature.

## 4. Service in `lib/services`

- Add the function to the aggregate's module (`lib/services/<resource>.ts`). Import `db` from `@/lib/db` only.
- Take `actor: Actor` first when the operation needs a permission; call `assertCan(actor, "<capability>")` before touching data.
- Throw `new NotFoundError("<Entity>", id)` for missing records; validation that needs the database (e.g. "currency must be one the customer uses") throws `ApiError` or `DomainError` with a code from the table.
- Writes: everything inside `db.$transaction(async (tx) => { ... })`, using `tx`, with `recordAudit(tx, { actor, entityType, entityId, action, before, after })` for each state change. New audit actions go in `lib/domain/audit.ts`.
- Load data with Prisma, then hand it to the domain function from step 2. Return plain JSON-friendly objects.

## 5. Route handler in `app/api`

- File: `app/api/<path>/route.ts`; `:id` becomes a `[id]` folder.
- Shape:

```ts
export const GET = handle<{ id: string }>(async (request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  const query = parseQuery(request, someQuerySchema);
  return ok(await someService(id, query));
});
```

- Writes add `const input = await parseJson(request, schema)` and `const actor = await actorFromRequest(request)`, and return `created(...)` for new resources.
- One service call. No Prisma, no `try/catch`, no hand-written error JSON.

## 6. Integration tests in `tests/integration`

- File: `tests/integration/<resource>-api.test.ts`. Start with `beforeAll(resetDatabase)`; the seed is relative to `NOW` and lives in `prisma/demo-data.ts` (customer ids look like `cus_kookaburra`).
- Call the handler with `callRoute` from `tests/integration/helpers.ts`:

```ts
const { status, body } = await callRoute<{ id: string }, { data: Statement }>(GET, {
  path: "/api/customers/cus_kookaburra/statement",
  params: { id: "cus_kookaburra" },
  query: { currency: "AUD" },
  as: viewer, // viewer | agent (default) | admin
});
```

- Cover at least: the happy path (check numbers against the database with `db`, not hard-coded seed values), a validation error (400 `VALIDATION_FAILED`), not found (404 `NOT_FOUND`), and role checks (403 `FORBIDDEN` for a role without the capability, or that `viewer` succeeds for reads). For writes, assert the audit entry with `auditFor(id)`.

## 7. Document it

- Add a row to the API table in `docs/architecture.md` (`| Method | Path | Notes |`), next to related endpoints. Mention query params and defaults in Notes.

## 8. Verify

- Run `npm run lint`, `npm run typecheck` and `npm test` (or `npm run test:unit` and `npm run test:integration`). Fix what you broke.
- Tests named `[filter-bug] ...` fail on purpose until step 3 of the workshop. Leave them alone.
- If the dev server is running, `curl -s http://localhost:3000/api/<path>` to check the real response.
- Finish with a short summary: files added or changed, the response shape, and any assumptions.
