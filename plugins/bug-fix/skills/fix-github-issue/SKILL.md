---
name: fix-github-issue
description: Workflow for fixing a bug reported in a GitHub issue, from reading the issue to opening a pull request. Use when asked to fix a GitHub issue, fix a bug by issue number or URL, or run /fix-issue.
---

# Fix a GitHub issue

A disciplined bug-fix loop: understand, reproduce, fix, verify, ship. Do the steps in order and do not skip the failing test.

## 1. Read the issue

- Work out the repository from `git remote get-url origin` (owner and name).
- Read the issue **and its comments** with the GitHub MCP server's issue tool (for example `issue_read` / `get_issue`). If the GitHub MCP server is not connected, fall back to `gh issue view <number> --json title,body,labels,comments`. If the user pointed you at a local file or pasted the issue text, use that.
- If none of these work, stop and tell the user how to connect the GitHub MCP server.
- Restate the bug in your own words: steps to reproduce, expected behaviour, actual behaviour. If the issue is ambiguous, say what you are assuming.

## 2. Find the code

- Read the project's architecture notes first if they exist (`docs/architecture.md`, `README.md`, `.cursor/rules/`).
- If the issue names tests, files or error messages, search the repo for them first. They usually lead straight to the code.
- Trace the behaviour from the entry point the issue describes (page, API route, CLI command) down to where the data is produced. Name the exact function where expected and actual behaviour diverge.

## 3. Reproduce with a failing test

- Run the existing test suites **before** editing anything (for example `npm test`, plus `npm run test:e2e` if the project has one and the issue involves a page). Don't edit files while an end-to-end run is in progress, because its dev server watches the source tree.
- Always run every test the issue names, whichever suite it is in.
- If a test already fails because of this bug, use it. Otherwise write a new test at the lowest level that shows the bug:
  - pure logic → unit test,
  - an API contract or a mismatch between client and server → integration test that exercises the real code path,
  - a browser-only flow → end-to-end test.
- Run it and confirm it fails **for the reason described in the issue**, not because of a typo or setup problem.

## 4. Fix the root cause

- Decide which side is the source of truth before you change anything: the schema, the documented API, the conventions in `.cursor/rules/`. Fix the side that disagrees with it. Don't add compatibility shims that accept both the right and the wrong input; that makes the tests pass while leaving the contract broken.
- Make the smallest change that fixes the cause, not the symptom, and follow the project's conventions and rules.
- Do not weaken or delete the failing test to make it pass. If the test itself is wrong, explain why before changing it.
- Look for the same mistake nearby (other callers, other parameters) and fix those too if they are part of the same bug.

## 5. Verify

- Run the reproducing test and confirm it passes.
- Run the full project checks. In this kind of project that usually means `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e` whenever the issue involves a page or names an end-to-end test.
- If anything else fails, fix it or explain clearly why it is unrelated.

## 6. Open a pull request

- Branch: if you're already on a matching `fix/issue-<number>-*` branch, use it. Otherwise create `fix/issue-<number>-<short-slug>` from the branch the user is on (unless they say otherwise). Never commit to the default branch directly.
- Stage only the files you changed (`git add <paths>`, not `git add -A`). Check `git status` before and after committing: test reports, local databases, `.env` files and secrets must never be committed.
- Commit with a message like `Fix <short summary> (#<number>)` and push the branch to `origin`.
- Open the pull request with the GitHub MCP server's pull request tool (for example `create_pull_request`), or `gh pr create` as a fallback, against the branch you started from. Use this body:

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

Reply with:

- the pull request URL,
- the root cause in one or two sentences,
- the files changed,
- the checks you ran, with their results.
