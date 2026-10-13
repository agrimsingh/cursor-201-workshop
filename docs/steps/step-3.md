# Step 3: MCPs and the plugin marketplace (about 12 min)

**Branch when you start:** `step-2-rules-skills` · **Finished state:** `step-3-mcp-plugin`

## Goal

Connect Cursor to your issue tracker (GitHub Issues, through the GitHub MCP server), see how admins control which MCP servers and tools are allowed, then install a **bug-fix plugin** that takes an issue all the way to a pull request: it reads the issue, reproduces it with a failing test, fixes it, and opens a PR.

The bug: on **Invoices**, filtering by **Status → Overdue** still lists every invoice.

## Before you start (one-time)

1. **Work on your own fork.** The agent will push a branch and open a PR, so `origin` must be a repo you own. If you followed the setup in the README, you already cloned your fork. If you cloned `agrimsingh/cursor-201-workshop` directly, fork it on GitHub (**untick "Copy the main branch only"**) and repoint your clone:

   ```bash
   git remote rename origin upstream
   git remote add origin https://github.com/<you>/cursor-201-workshop.git
   git fetch origin
   ```

2. **Turn on Issues** for the fork: **Settings → General → Features → Issues** (forks have Issues switched off by default).
3. **Open the bug issue:** **Issues → New issue → "Bug: invoice status filter is ignored" → Submit**. Note its number (probably `#1`).
4. **Create a GitHub token** for the MCP server: **GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Repository access: only your fork.
   - Permissions: **Issues** read and write, **Pull requests** read and write, **Contents** read and write (Metadata read-only is added automatically).
5. **Put the token in your environment, never in the repo.** For example, in `~/.zshrc` or `~/.bashrc`:

   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN="<your token>"
   ```

   Then fully quit Cursor and start it again from a new terminal with `cursor .`, so it picks up the variable. On Windows, use `setx GITHUB_PERSONAL_ACCESS_TOKEN "<your token>"` and restart Cursor.

## Open in Cursor

- **Customize** in the sidebar (MCP servers, plugins, rules and skills all live here).
- `components/invoices/invoice-list.tsx`, `lib/client/invoice-list-params.ts`, `app/api/invoices/route.ts`, `lib/validation/invoices.ts` (this is where the bug lives, if you want to look).
- A new **Agent** chat.

## Do it

### 1. Connect the GitHub MCP server

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

`${env:GITHUB_PERSONAL_ACCESS_TOKEN}` is read from your environment when Cursor starts. The file contains no secret and is safe to commit.

Open **Customize → MCP**, check that **github** is enabled and lists tools, then try:

```text
Use the GitHub MCP server to list the open issues in <you>/cursor-201-workshop, and summarise the bug issue.
```

Approve the tool call when Cursor asks.

> Prefer OAuth? Install **GitHub** from the Cursor Marketplace in **Customize** and sign in instead of using a token. Keep the server name `github`.

### 2. The MCP allowlist (what your admin controls)

On Enterprise plans, admins decide which MCP servers and tools people can run under **Dashboard → Team Settings → MCP Configuration**. For this workshop that would be:

- a **URL entry** approving `https://api.githubcopilot.com/mcp/*`;
- a **tool allowlist** limiting that server to what the bug-fix flow needs, for example reading issues, listing issues, creating branches and creating pull requests.

Allowlisting approves a configuration; it doesn't install anything. On your own machine, **Settings → Agents → Approvals & Execution** decides whether MCP tool calls ask for approval first. Leave approvals on for this step so you can see each GitHub call.

### 3. Install the bug-fix plugin

The plugin lives in this repo at `plugins/bug-fix/`. In a real team you'd install it from your **Team Marketplace** (this repo includes `.cursor-plugin/marketplace.json`, so an admin can import it under **Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace → Import from Repo**). For the workshop, install it locally:

```bash
mkdir -p ~/.cursor/plugins/local
cp -R plugins/bug-fix ~/.cursor/plugins/local/bug-fix
```

Run **Developer: Reload Window** from the Command Palette. Then open **Customize** and check that the **bug-fix** plugin shows the `fix-issue` command and the `fix-github-issue` skill.

### 4. Fix the issue

In a new Agent chat:

```text
/fix-issue 1
```

Use your issue number. Approve the GitHub tool calls as they come up.

## What you should see

1. The agent reads issue #1 through the GitHub MCP server.
2. It runs the tests and finds the failing `[filter-bug]` test (or writes one).
3. It traces the request: the invoices page builds its query string in `lib/client/invoice-list-params.ts` with `state=overdue`, but `GET /api/invoices` validates `status` with zod. Zod strips unknown keys, so the filter silently disappears and every invoice comes back.
4. It fixes the mismatch, reruns lint, typecheck and tests, and commits on a `fix/issue-1-...` branch.
5. It pushes the branch and opens a pull request on your fork, targeting the branch you started from (`step-2-rules-skills`), with `Fixes #1` in the description.

## Check it worked

```bash
npm test                                   # all green, including [filter-bug]
npx playwright test e2e/invoices.spec.ts   # the e2e filter test passes too
```

Then open http://localhost:3000/invoices, choose **Overdue**, and check that only overdue invoices are listed and the count drops. Keep the pull request open: Bugbot reviews it in step 6.

## Catch up

If you have local edits, put them aside first with `git stash` (or discard them with `git checkout -- . && git clean -fd`).

```bash
git checkout step-3-mcp-plugin
npm install && npx prisma generate && npx prisma db seed
npm run dev   # restart it if it was already running
```

`step-3-mcp-plugin` contains `.cursor/mcp.json` and the fix. You still need your own token (or the OAuth install) and your own fork to open a PR.

## Try it yourself

- Ask the agent to **file** a GitHub issue through MCP for something you noticed in the app, then fix it with `/fix-issue`.
- Add a `triage-issue` command to the plugin that labels an issue and asks clarifying questions in a comment, without changing code.
- Add a hook to the plugin (`hooks/hooks.json`) that runs `npm run lint` after every file edit (`afterFileEdit`).
