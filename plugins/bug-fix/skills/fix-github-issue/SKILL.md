---
name: fix-github-issue
description: Workflow for fixing a bug reported in a GitHub issue, from reading the issue to opening a pull request. Use when asked to fix a GitHub issue, fix a bug by issue number or URL, or run /fix-issue.
---

# Fix a GitHub issue

A disciplined bug-fix loop: understand, reproduce, fix, verify, ship. Do the steps in order and do not skip the failing test.

## 1. Read the issue

- Work out the repository from `git remote get-url origin` (owner and name).
- Read the issue **and its comments** with the GitHub MCP server's issue tool (for example `issue_read` / `get_issue`). If the GitHub MCP server is not connected, fall back to `gh issue view <number> --json title,body,labels,comments`. If neither works, stop and tell the user how to connect the GitHub MCP server.
- Restate the bug in your own words: steps to reproduce, expected behaviour, actual behaviour. If the issue is ambiguous, say what you are assuming.

## 2. Find the code

- Read the project's architecture notes first if they exist (`docs/architecture.md`, `README.md`, `.cursor/rules/`).
- Trace the behaviour from the entry point the issue describes (page, API route, CLI command) down to where the data is produced. Name the exact function where expected and actual behaviour diverge.

## 3. Reproduce with a failing test

- Run the existing test suite (for example `npm test`). If a test already fails because of this bug, use it.
- Otherwise write a new test at the lowest level that shows the bug:
  - pure logic → unit test,
  - an API contract or a mismatch between client and server → integration test that exercises the real code path,
  - a browser-only flow → end-to-end test.
- Run it and confirm it fails **for the reason described in the issue**, not because of a typo or setup problem.

## 4. Fix the root cause

- Make the smallest change that fixes the cause, not the symptom. Prefer fixing the side that is wrong over adding compatibility shims for both.
- Follow the project's conventions and rules. Do not weaken or delete the failing test to make it pass. If the test itself is wrong, explain why before changing it.
- Look for the same mistake nearby (other callers, other parameters) and fix those too if they are part of the same bug.

## 5. Verify

- Run the reproducing test and confirm it passes.
- Run the full project checks. In this kind of project that usually means `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e` when the change touches the UI.
- If anything else fails, fix it or explain clearly why it is unrelated.

## 6. Open a pull request

- Create a branch named `fix/issue-<number>-<short-slug>` from the default branch. Never commit to the default branch directly.
- Commit with a message like `Fix <short summary> (#<number>)`. Check `git status` first and never commit secrets, `.env` files or local databases.
- Push the branch to `origin`.
- Open the pull request with the GitHub MCP server's pull request tool (for example `create_pull_request`), or `gh pr create` as a fallback. Use this body:

```markdown
## Summary
<one or two sentences>

## Root cause
<what was wrong and where>

## Fix
<what changed>

## Tests
- <the reproducing test, failing before and passing after>
- <checks you ran>

Fixes #<number>
```

## 7. Report back

Reply with the pull request URL, the root cause, the files changed, and the checks you ran with their results.
