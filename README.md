# Cursor 201 workshop: Tally

A hands-on workshop for getting more out of Cursor on a real codebase. You'll work on **Tally**, a small accounts-receivable console for a B2B company, and practise six techniques: managing context, rules and skills, MCPs and plugins, model selection, parallel subagents, and Cloud Agents with Bugbot.

Every section of the workshop has a branch with its finished state, so you can follow along live, jump ahead, or catch up at any point. After the session, the [homework](#keep-building) turns the Collections queue into a proper product.

- [What you'll do](#what-youll-do)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Jump to a step](#jump-to-a-step)
- [The workshop, step by step](#the-workshop-step-by-step)
- [Connect the GitHub MCP server](#connect-the-github-mcp-server)
- [Install the bug-fix plugin](#install-the-bug-fix-plugin)
- [Enable Bugbot on your fork](#enable-bugbot-on-your-fork)
- [Tally in five minutes](#tally-in-five-minutes)
- [Tests and checks](#tests-and-checks)
- [Troubleshooting](#troubleshooting)
- [Keep building](#keep-building)

## What you'll do

| # | Section | Time | You'll learn to |
| --- | --- | --- | --- |
| 1 | Context 60/40 | 8 min | Scope chats with @-mentions, read the context ring, reuse work with `@Chats` |
| 2 | Rules and skills | 10 min | Capture conventions with `/create-rule` and repeatable workflows with `/create-skill` |
| 3 | MCPs and marketplace | 12 min | Connect GitHub Issues through MCP, understand MCP allowlists, fix a bug end to end with a plugin |
| 4 | Model selection | 5 min | Choose between fast models, frontier models and Auto |
| 5 | Parallelizing | 12 min | Split a plan across subagents in worktrees with `/multitask`, track it on a Canvas, review with a subagent |
| 6 | Cloud Agents and Bugbot | 10 min | Hand work to a cloud agent, pick it up locally, and get project-aware PR reviews |

## Prerequisites

- **Cursor**, latest version (**Help → About**; update with **Check for Updates**). You'll use Agent, Plan mode, `@Chats`, rules, skills, MCP, plugins, subagents, `/multitask` and Canvas.
  - **Cloud Agents** and **Bugbot** (step 6) need a paid Cursor plan.
  - **Team Marketplaces** and the **MCP allowlist** (step 3) are Teams and Enterprise admin features. The workshop explains them, but you don't need them to follow along.
- **Node.js 20.19+ or 22.12+** (`node -v`). Node 22 LTS is recommended.
- **Git** and a **GitHub account** (for your fork, issues, pull requests and Bugbot).
- **GitHub CLI** (`gh`): optional. The bug-fix plugin falls back to it if the GitHub MCP server isn't connected.
- No database server, Docker, cloud account or environment variables are needed. Tally runs offline on SQLite.

## Setup

1. **Fork** this repository on GitHub and **untick "Copy the main branch only"**, so your fork has every step branch. (You need your own fork for step 3, when the agent pushes a branch and opens a pull request.)
2. **Clone your fork and set up Tally** with these four commands:

   ```bash
   git clone https://github.com/<you>/cursor-201-workshop.git
   cd cursor-201-workshop

   npm install
   npx prisma generate
   npx prisma db seed
   npm run dev
   ```

3. Open http://localhost:3000. You should see the Tally dashboard with balances in six currencies.
4. Open the folder in Cursor (`cursor .`, or **File → Open Folder**).

`npx prisma db seed` creates `prisma/dev.db` from scratch and loads about 47 invoices, 12 customers, payments, credit notes, disputes and their audit history. Dates are relative to today, so the aging buckets always look realistic. Re-run it whenever you want a clean slate or switch branches.

Optional, for the end-to-end tests: `npx playwright install chromium`.

## Jump to a step

Each branch is the **finished** state of that section and includes everything before it. To start a section, check out the previous step's branch. To catch up, check out that section's branch.

| Step | Branch | What you'll do | Catch up |
| --- | --- | --- | --- |
| Start | `main` | Tally with a planted filter bug and an unbuilt "resolve dispute" feature | `git checkout main` |
| 1 | `step-1-context` | Compare whole-app vs @-scoped chats, reuse with `@Chats`, add a "Days late" column | `git checkout step-1-context` |
| 2 | `step-2-rules-skills` | `/create-rule` for API conventions, `/create-skill` for `create-api`, build a customer statement endpoint with it | `git checkout step-2-rules-skills` |
| 3 | `step-3-mcp-plugin` | Connect the GitHub MCP server, install the bug-fix plugin, fix the filter bug and open a PR | `git checkout step-3-mcp-plugin` |
| 4 | `step-4-models` | Compare fast, frontier and Auto models; read the model selection guide | `git checkout step-4-models` |
| 5 | `step-5-multitask` | Build "resolve a dispute" with `/multitask`, three subagents in worktrees, a Canvas and a reviewer subagent | `git checkout step-5-multitask` |
| 6 | `step-6-cloud-bugbot` | Hand a CSV export to a Cloud Agent, pick it up locally, and have Bugbot review your PRs | `git checkout step-6-cloud-bugbot` |

If you have local edits, put them aside first with `git stash` (or discard them with `git checkout -- . && git clean -fd`). After switching branches, run:

```bash
npm install && npx prisma generate && npx prisma db seed
```

## The workshop, step by step

Each step below has a summary. Follow the link for the full guide with every prompt, what you should see, and extension ideas.

### Step 1: Context 60/40

**Goal:** better answers from less, better-chosen context. **Start from:** `main`. **Full guide:** [docs/steps/step-1.md](docs/steps/step-1.md)

1. **Open** `docs/architecture.md` (written to be @-attached), the Agent chat, and http://localhost:3000/invoices.
2. **Whole-app chat** (Ask mode, nothing attached): `How does Tally work? Walk me through how an invoice becomes overdue and how the invoices list page gets its data.` Then check the **context ring** next to the input.
3. **Scoped chat** (Agent mode): `@docs/architecture.md @lib/domain/aging.ts @lib/domain/invoice-status.ts @lib/services/invoices.ts @components/invoices/invoice-list.tsx Add a "Days late" column to the invoices list...` (the full prompt is in the guide). Compare the context ring.
4. **Reuse it:** in a new chat, `@Chats` → pick the previous chat → `Add an integration test ... that checks daysPastDue ...`.
5. **You should see** a **Days late** column on `/invoices`, and the scoped chat using far less context.
6. **Check:** `npm run test:integration`. Your new test passes; only the `[filter-bug]` test fails (that's for step 3).
7. **Catch up:** `git checkout step-1-context`.
8. **Try it yourself:** add a "Days late" sort option, and work out which files you need to @-mention.

### Step 2: Rules and skills

**Goal:** teach Cursor the team's conventions once. **Start from:** `step-1-context`. **Full guide:** [docs/steps/step-2.md](docs/steps/step-2.md)

1. **Open** `app/api/invoices/route.ts`, `lib/http/route.ts`, `lib/services/payments.ts`.
2. **Rule:** `/create-rule API conventions for Tally. Apply it to app/api/**, lib/services/** and lib/validation/** ...` produces `.cursor/rules/api-conventions.mdc` (zod at every boundary, the standard error shape, Prisma only through `lib/db` in services, `assertCan` + transactions + audit for writes).
3. **Skill:** `/create-skill create-api: a project skill for adding a new HTTP endpoint ...` produces `.cursor/skills/create-api/SKILL.md`. If it lands in `~/.cursor/skills`, move it into `.cursor/skills/` to make it a project skill.
4. **Use it:** `/create-api GET /api/customers/:id/statement ...` (a customer statement with a running balance).
5. **You should see** the rule listed under **Rules** in the context ring when editing API files, and a schema, service, route, tests and docs row created by following the skill.
6. **Check:** `npm test`, then `curl -s http://localhost:3000/api/customers/cus_kookaburra/statement`.
7. **Catch up:** `git checkout step-2-rules-skills`.
8. **Try it yourself:** ask for `GET /api/credit-notes` with no extra instructions and see whether the rule is enough.

### Step 3: MCPs and the plugin marketplace

**Goal:** go from a GitHub issue to a pull request without leaving Cursor. **Start from:** `step-2-rules-skills`. **Full guide:** [docs/steps/step-3.md](docs/steps/step-3.md)

1. **Before you start:** enable Issues on your fork, open the **"Bug: invoice status filter is ignored"** issue from the template, and [connect the GitHub MCP server](#connect-the-github-mcp-server) with your own token.
2. **Open** **Customize** in the sidebar and check that the **github** MCP server lists its tools. Try: `Use the GitHub MCP server to list the open issues in <you>/cursor-201-workshop.`
3. **Allowlist:** the guide shows what an Enterprise admin configures under **Team Settings → MCP Configuration**, and where you control tool approvals (**Settings → Agents → Approvals & Execution**).
4. **Plugin:** [install the bug-fix plugin](#install-the-bug-fix-plugin), then run `/fix-issue 1` (your issue number).
5. **You should see** the agent read the issue over MCP, find the failing `[filter-bug]` test, trace the bug (the page sends `?state=` but the API reads `status`), fix it, run the checks, push a `fix/issue-1-...` branch and open a PR with `Fixes #1`.
6. **Check:** `npm test` is fully green, `npx playwright test e2e/invoices.spec.ts` passes, and **Status → Overdue** on `/invoices` shows only overdue invoices.
7. **Catch up:** `git checkout step-3-mcp-plugin` (adds `.cursor/mcp.json` and the fix).
8. **Try it yourself:** have the agent file a new issue through MCP, then fix it with `/fix-issue`.

### Step 4: Model selection

**Goal:** pick the right model for the job. **Start from:** `step-3-mcp-plugin`. **Full guide:** [docs/steps/step-4.md](docs/steps/step-4.md)

1. **Open** the model picker under the chat input (`Cmd+/` cycles models) and **Cursor Settings → Models**.
2. **Small edit** with a fast model, then Auto: `@components/collections/overdue-sweep-button.tsx Change the success message to say "1 invoice marked overdue" (singular) ...`.
3. **Design question** with a frontier model, then a fast model: `@docs/architecture.md @lib/domain/aging.ts @lib/services/reports.ts We want collections to prioritise by risk ... Don't write code yet.`
4. **You should see** both models handle the small edit; the frontier model produce a deeper, more complete design; and Auto choose sensibly. Discard the edits afterwards.
5. **Check:** compare your notes with [docs/model-selection.md](docs/model-selection.md) (on `step-4-models` and later).
6. **Catch up:** `git checkout step-4-models`.
7. **Try it yourself:** plan with a frontier model in Plan mode, then build with a fast model; or run `/best-of-n` across models.

### Step 5: Parallelizing

**Goal:** build a feature as three parallel workstreams. **Start from:** `step-4-models`. **Full guide:** [docs/steps/step-5.md](docs/steps/step-5.md)

1. **Open** [`.cursor/plans/resolve-dispute.md`](.cursor/plans/resolve-dispute.md) (a shared contract plus workstreams A: API + Prisma, B: UI, C: tests + audit) and `.cursor/worktrees.json` (worktree setup).
2. **Subagents:** create `.cursor/agents/reviewer.md` (read-only code review against the rules) and `.cursor/agents/verifier.md` (runs the checks and confirms the plan's acceptance criteria). The prompt is in the guide.
3. **Fan out:** `/multitask Implement @.cursor/plans/resolve-dispute.md` with step 0 first, then A, B and C as parallel subagents in their own worktrees, a Canvas for status, a merge in the order A → B → C, and a reviewer pass. Alternatively, click **Build in Parallel** on the plan.
4. **You should see** three subagents running at once, a Canvas updating as they report, then a merged branch with `POST /api/disputes/:id/resolve`, a **Resolve dispute** dialog for admins, and `[resolve-dispute]` tests.
5. **Check:** `npm test && npm run test:e2e`. In the app, switch to **Dana Okafor (admin)**, open a dispute and resolve it.
6. **Catch up:** `git checkout step-5-multitask`, then re-run the seed (the schema changed).
7. **Try it yourself:** run the plan without step 0 and see how much harder the merge gets.

### Step 6: Cloud Agents and Bugbot

**Goal:** run work in the background and get project-aware reviews. **Start from:** `step-5-multitask`. **Full guide:** [docs/steps/step-6.md](docs/steps/step-6.md)

1. **Before you start:** [enable Bugbot on your fork](#enable-bugbot-on-your-fork), and push `.cursor/BUGBOT.md` to your fork's `main`.
2. **Cloud Agent:** commit and push, select **Cloud** under the chat input, and paste the CSV export task from the guide (`GET /api/collections/export` plus an **Export CSV** link, with formula-injection-safe escaping and tests). From an existing local chat, use **Move to Cloud**.
3. **Pick it up:** in the Agents Window use **Move to Local**, or check out the agent's branch.
4. **Bugbot:** on the PR from step 3 (and the cloud agent's PR), comment `bugbot run` (add `verbose=true` to see the rules it loaded).
5. **You should see** a cloud agent PR with the CSV export, and Bugbot comments that refer to the guidance in `.cursor/BUGBOT.md`.
6. **Check:** `npm test`, and **Export CSV** on `/collections` downloads `collections-YYYY-MM-DD.csv`.
7. **Catch up:** `git checkout step-6-cloud-bugbot`.
8. **Try it yourself:** start a homework issue in a cloud agent and let Bugbot review it.

## Connect the GitHub MCP server

Step 3 uses the official GitHub MCP server to read issues and open pull requests. Your token stays in **your environment**; the repo only contains a reference to it.

1. Create a **fine-grained personal access token** (**GitHub → Settings → Developer settings → Fine-grained tokens**) with access to **only your fork**, and these permissions: **Issues** (read and write), **Pull requests** (read and write), **Contents** (read and write).
2. Export it in your shell profile (`~/.zshrc`, `~/.bashrc`), **not** in the repo:

   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN="<your token>"
   ```

   On Windows: `setx GITHUB_PERSONAL_ACCESS_TOKEN "<your token>"`.
3. Fully quit Cursor and reopen it from a new terminal (`cursor .`) so it inherits the variable.
4. Use this `.cursor/mcp.json` (already on `step-3-mcp-plugin` and later):

   ```json
   {
     "mcpServers": {
       "github": {
         "url": "https://api.githubcopilot.com/mcp/",
         "headers": { "Authorization": "Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}" }
       }
     }
   }
   ```

5. Check **Customize → MCP**: **github** should be enabled with a list of tools.

**Without a token:** install **GitHub** from the Cursor Marketplace in **Customize** and sign in with OAuth instead. Never paste a token into `mcp.json`, a rule, a prompt you commit, or an issue. `npm run validate:cursor` fails if `mcp.json` contains a literal secret.

## Install the bug-fix plugin

The plugin in [`plugins/bug-fix/`](plugins/bug-fix/) uses Cursor's plugin format: a `.cursor-plugin/plugin.json` manifest, a `/fix-issue` command and a `fix-github-issue` skill.

```bash
mkdir -p ~/.cursor/plugins/local
cp -R plugins/bug-fix ~/.cursor/plugins/local/bug-fix
```

Then run **Developer: Reload Window** and confirm the plugin in **Customize**. Copy the folder rather than symlinking it (Cursor skips symlinks that point outside `~/.cursor/plugins/local`). On Teams and Enterprise plans, an admin must allow local plugins (**Dashboard → Settings → Security & Identity → Marketplace and Plugins**).

**For teams:** this repo includes `.cursor-plugin/marketplace.json`, so an admin can import it as a **Team Marketplace** (**Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace → Import from Repo**) and make the plugin **Default Off**, **Default On** or **Required** for everyone. That's how you'd distribute a plugin like this across a company.

## Enable Bugbot on your fork

1. Go to [cursor.com/dashboard](https://cursor.com/dashboard) → **Integrations** and connect **GitHub**. Grant the Cursor app access to your fork.
2. Open **Bugbot** (under **Automations**) and turn it on for `<you>/cursor-201-workshop`.
3. Make sure `.cursor/BUGBOT.md` is on your fork's `main`. Bugbot reads it from the PR's base branch.
4. Open or update a PR, or comment `bugbot run` on an existing one. Add `verbose=true` to list the rules it used.

Bugbot needs a paid plan. On individual plans it reviews PRs you author. On Teams and Enterprise, an admin may need to enable the repository.

## Tally in five minutes

| Page | What it shows |
| --- | --- |
| **Dashboard** (`/`) | Outstanding, past due and on-hold balances per currency, and the aging table |
| **Invoices** (`/invoices`) | Server-side filtering, sorting and pagination over every invoice |
| **Invoice** (`/invoices/[id]`) | Lines, payments applied, credit notes, disputes, history; send, void, record payment, credit, dispute |
| **Customers** | Open balances per currency, payments, unapplied credit |
| **Payments** | Money received and how it was allocated; **Record payment** allocates across invoices |
| **Disputes** | Open, under review and withdrawn disputes (disputed invoices are on hold) |
| **Collections** | The aging report (0–30, 31–60, 61–90, 90+ days) and the queue of past-due invoices to chase |
| **Audit log** | Every state change: who, when, before and after |

Use **Acting as** in the header to switch between **Priya Shah (viewer)**, **Marcus Lee (agent)** and **Dana Okafor (admin)**. There's no real login; the switcher sets a cookie.

Under the hood: money is integer minor units with a currency code; invoice and dispute statuses are explicit state machines in `lib/domain/`; services in `lib/services/` own transactions, permissions and the audit log; zod validates every API input; and every error has the same shape. Read [docs/architecture.md](docs/architecture.md) for the full picture.

On `main` you'll find two things left in on purpose:

- **A bug:** filtering the invoices list by status doesn't work. Step 3 fixes it. Two tests named `[filter-bug] ...` fail until then.
- **An unbuilt feature:** resolving a dispute. Step 5 builds it from [`.cursor/plans/resolve-dispute.md`](.cursor/plans/resolve-dispute.md).

## Tests and checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Domain logic: state machines, allocation, aging, money, permissions |
| `npm run test:integration` | API route handlers against a throwaway SQLite database |
| `npm test` | Unit + integration |
| `npm run test:e2e` | Playwright: list and filter invoices, record a payment, open a dispute (and resolve one from step 5). Uses its own database (`prisma/e2e.db`) on port 3100, so it can run next to `npm run dev`. |
| `npm run validate:cursor` | Checks rules, skills, subagents, `mcp.json` (no secrets), the plugin and marketplace manifests, and `BUGBOT.md` |
| `scripts/verify-steps.sh` | Clones every step branch fresh and runs setup, the dev server, all checks and the expected test outcome for each step |

Expected results: on `main`, `step-1-context` and `step-2-rules-skills`, exactly the `[filter-bug]` tests fail (one integration test and one e2e test). From `step-3-mcp-plugin` on, everything passes. CI (`.github/workflows/ci.yml`) runs all of this on every push and pull request, so it shows red on those first three branches by design.

## Troubleshooting

**Reset the database.** `npx prisma db seed` deletes `prisma/dev.db` and rebuilds it from the current branch's schema. Run it after switching branches, after a schema change, or if the data looks wrong. If you see `no such table` or `no such column`, you skipped this.

**"Prisma Client could not be found" or type errors in `lib/generated`.** Run `npx prisma generate`. The client is generated into `lib/generated/prisma` and isn't committed.

**`better-sqlite3` fails to install or load.** It's a native module with prebuilt binaries for current Node versions. Use Node 20.19+ or 22 LTS, then `rm -rf node_modules && npm install`. If you change Node versions, run `npm rebuild better-sqlite3`.

**"Another next dev server is already running".** Next.js allows one dev server per project folder. The message shows the PID and URL of the running one: use it, or stop it (`Ctrl+C` in its terminal, or `kill <PID>`).

**Port 3000 is in use by something else.** Run on another port with `npm run dev -- --port 3001`. To find what's using a port: `lsof -i :3000` (macOS and Linux) or `netstat -ano | findstr :3000` (Windows).

**Playwright can't find a browser.** Run `npx playwright install chromium`. On Linux CI machines, use `npx playwright install --with-deps chromium`. If port 3100 is taken, set `E2E_PORT=3101 npm run test:e2e`.

**The GitHub MCP server shows no tools or returns 401.** Check `echo $GITHUB_PERSONAL_ACCESS_TOKEN` in the terminal you launched Cursor from, make sure the token can access your fork with the permissions above, and restart Cursor. **Output → MCP Logs** shows connection errors.

**The plugin doesn't appear.** It must be at `~/.cursor/plugins/local/bug-fix/.cursor-plugin/plugin.json` (a copy, not a symlink). Run **Developer: Reload Window**. On a team plan, check that local plugins are allowed.

**A step branch is missing from your fork.** You forked with "Copy the main branch only" ticked. Fetch the branches from the original repo:

```bash
git remote add upstream https://github.com/agrimsingh/cursor-201-workshop.git
git fetch upstream
git checkout -b step-3-mcp-plugin upstream/step-3-mcp-plugin
```

## Keep building

The Collections queue works, but a real collections team needs much more. [docs/homework.md](docs/homework.md) has nine follow-up tasks, each also available as a GitHub issue template labelled `homework` (**Issues → New issue** on your fork):

1. Dunning reminder schedule
2. Aging trend snapshots
3. Promise to pay
4. Bulk actions on the queue
5. Collector assignment and "My queue"
6. Snooze and next follow-up date
7. Priority score
8. Credit hold
9. Bad-debt write-off with approval

Start from `step-6-cloud-bugbot`. For each task, try writing a plan first (Plan mode), use the `create-api` skill for new endpoints, run independent parts in parallel or in a cloud agent, and let Bugbot review the pull request.

**Contributing back:** found a bug in the workshop or have an idea for a better exercise? Open an issue or a pull request against `main` on [agrimsingh/cursor-201-workshop](https://github.com/agrimsingh/cursor-201-workshop). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Agrim Singh
