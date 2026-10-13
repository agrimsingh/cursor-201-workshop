# Step 6: Cloud Agents and Bugbot (about 10 min)

**Branch when you start:** `step-5-multitask` · **Finished state:** `step-6-cloud-bugbot`

## Goal

Hand a well-scoped task to a **Cloud Agent** so it runs on its own VM while you keep working, pick its result up in the desktop app, and let **Bugbot** review a pull request using project-specific guidance from `.cursor/BUGBOT.md`.

## Before you start (one-time)

- **Connect GitHub to Cursor:** [cursor.com/dashboard](https://cursor.com/dashboard) → **Integrations** → **GitHub**, and give the Cursor app access to your fork.
- **Enable Bugbot on your fork:** in the dashboard, open **Bugbot** (under **Automations**) and switch it on for `<you>/cursor-201-workshop`. On individual plans, Bugbot reviews PRs you author. On Teams and Enterprise plans an admin may need to enable the repository for you.
- Cloud Agents and Bugbot need a paid Cursor plan. Check which features your plan includes before the session.

## Open in Cursor

- `.cursor/BUGBOT.md`: project-specific review guidance for Bugbot. Bugbot reads it from each **PR's base branch**, so add it to the branches your PRs target:

  ```bash
  # for the cloud agent's PR: the branch you're on now
  git checkout origin/step-6-cloud-bugbot -- .cursor/BUGBOT.md
  git commit -m "Add Bugbot review guidance" && git push

  # for the step 3 PR, which targets step-2-rules-skills
  git checkout step-2-rules-skills
  git checkout origin/step-6-cloud-bugbot -- .cursor/BUGBOT.md
  git commit -m "Add Bugbot review guidance" && git push
  git checkout -
  ```
- The Agent chat, with **Cloud** selected in the dropdown under the input.
- [cursor.com/agents](https://cursor.com/agents) to watch cloud agents from the browser.

## Do it

### 1. Hand a task to a Cloud Agent

Commit and push your work first: a cloud agent starts from what's on GitHub, not your uncommitted files. Then, in a new chat with **Cloud** selected under the input:

```text
In Tally, add a CSV export of the collections queue.

- New endpoint GET /api/collections/export that returns text/csv with Content-Disposition: attachment; filename="collections-YYYY-MM-DD.csv".
- Columns: Customer, Invoice, Currency, Balance, Due date, Days late, Bucket, Next step. Balance is a plain decimal string from toDecimalString (never a float), dates are YYYY-MM-DD.
- Put CSV escaping in a small pure helper (lib/csv.ts): quote fields that contain commas, quotes or newlines, double embedded quotes, and prefix values starting with =, +, - or @ with a single quote so spreadsheets don't run them as formulas.
- Add an "Export CSV" link next to the overdue sweep button on /collections. Viewers can export too.
- Follow .cursor/rules/api-conventions.mdc (errors stay JSON). Add unit tests for the CSV helper, an integration test for the endpoint (header row, one row per queue item, escaping), and update the API table in docs/architecture.md.
- Run npm run lint, npm run typecheck and npm test, then open a pull request.
```

Already in a local chat? Use **Move to Cloud** to hand the conversation over (it doesn't carry uncommitted files), or prefix a single task with `/in-cloud`.

### 2. Keep working, then pick it up

While the cloud agent works, carry on locally (for example, try a homework task). When it's done:

- In the **Agents Window**, open the cloud agent and use **Move to Local** (shown once the agent is idle) to continue in your local workspace, or
- check out its branch: `git fetch origin && git checkout <branch-from-the-agent>`, then run `npm test`.

### 3. Bugbot reviews the PR from step 3

Open the pull request the bug-fix plugin created in step 3. If Bugbot hasn't reviewed it yet, comment:

```text
bugbot run
```

Add `verbose=true` (`bugbot run verbose=true`) to see which rules Bugbot loaded, including `.cursor/BUGBOT.md`. Do the same on the cloud agent's CSV pull request. Use **Fix in Cursor** on any finding to open it locally with the context attached.

## What you should see

- A cloud agent running on its own branch, visible in the desktop app and at cursor.com/agents.
- A pull request from the cloud agent with `lib/csv.ts`, `app/api/collections/export/route.ts`, an **Export CSV** link on `/collections`, and tests.
- Bugbot comments on both PRs that refer to project rules from `.cursor/BUGBOT.md` (money as integers, audit entries, CSV formula injection, tests).

## Check it worked

```bash
npm test
curl -sD - http://localhost:3000/api/collections/export -o /dev/null | grep -i content-disposition
```

Then open http://localhost:3000/collections and click **Export CSV**.

## Catch up

If you have local edits, put them aside first with `git stash` (or discard them with `git checkout -- . && git clean -fd`).

```bash
git checkout step-6-cloud-bugbot
npm install && npx prisma generate && npx prisma db seed
```

## Try it yourself

- Pick a [homework task](../homework.md), start it in a cloud agent from the GitHub issue (comment `@cursor` on the issue if your GitHub integration is connected), and let Bugbot review the result.
- Add a rule to `.cursor/BUGBOT.md` that you care about, push it to `main` on your fork, and re-run Bugbot with `verbose=true` to see it picked up.
- Run `/review-bugbot` in a local chat before you push, to catch issues before Bugbot does.
