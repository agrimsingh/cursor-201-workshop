# Contributing

Thanks for helping improve the Cursor 201 workshop.

## Reporting problems

Open an issue on [agrimsingh/cursor-201-workshop](https://github.com/agrimsingh/cursor-201-workshop/issues) with the branch you were on, what you ran, and what happened. For setup problems, include `node -v` and your OS.

## Changing the workshop

The branches are cumulative: `main` → `step-1-context` → `step-2-rules-skills` → `step-3-mcp-plugin` → `step-4-models` → `step-5-multitask` → `step-6-cloud-bugbot`. Each one is the finished state of its section.

- Changes that apply to every step (the app, docs, scripts) go to `main` first, then get merged forward into each step branch in order.
- Changes to a single step go on that step's branch, then get merged forward into the later steps.
- Keep the planted bug (`[filter-bug]` tests) failing on `main`, `step-1-context` and `step-2-rules-skills`, and keep resolve-dispute unbuilt before `step-5-multitask`.
- Keep the docs attendee-facing: instructions and explanations, no talk tracks.

Before opening a pull request, run:

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
npm run validate:cursor
```

To check every branch from a fresh clone (slow; it runs the full setup and every test suite on each branch):

```bash
scripts/verify-steps.sh                 # all branches from GitHub
REPO=$(pwd) scripts/verify-steps.sh main step-3-mcp-plugin   # selected branches from your local clone
```

## Workshop issues

Maintainers can create the filter-bug issue and the nine homework issues from the templates in `.github/ISSUE_TEMPLATE/`:

```bash
scripts/create-workshop-issues.sh agrimsingh/cursor-201-workshop
```

## Secrets

Never commit tokens, `.env` files or local databases. `.cursor/mcp.json` must reference environment variables (`${env:NAME}`), and `npm run validate:cursor` scans every tracked file for common token formats.
