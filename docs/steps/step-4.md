# Step 4: Model selection (about 5 min)

**Branch when you start:** `step-3-mcp-plugin` · **Finished state:** `step-4-models`

## Goal

Choose a model on purpose. Fast models are great for small, well-specified edits; frontier models earn their keep on ambiguous, multi-file reasoning; **Auto** picks for you. There's no code in this step. The finished branch adds [`docs/model-selection.md`](../model-selection.md), a one-page guide you can share with your team.

## Open in Cursor

- The **model picker** at the bottom of the chat input (or `Cmd+/` / `Ctrl+/` to cycle models).
- **Cursor Settings → Models** for your default model.
- [`docs/model-selection.md`](../model-selection.md) on the `step-4-models` branch (or read it on GitHub).

## Do it

Run the same two prompts with different models. Start a **new chat** for each run so earlier context doesn't help.

**A small, well-specified edit.** Try it with a fast model, then with Auto:

```text
@components/collections/overdue-sweep-button.tsx Change the success message to say "1 invoice marked overdue" (singular) when exactly one invoice changes, and "N invoices marked overdue" otherwise.
```

**An open-ended design question.** Try it with a frontier model, then with a fast model:

```text
@docs/architecture.md @lib/domain/aging.ts @lib/services/reports.ts
We want collections to prioritise by risk rather than age alone. Propose a scoring approach that works across currencies, list the edge cases, and say which layers would change. Don't write code yet.
```

For each run, note how long it took, how many follow-ups you needed, and whether the result was right the first time. These edits are for comparison only: discard them afterwards with `git checkout -- .`.

## What you should see

- Small edit: both models get it right; the fast model is quicker.
- Design question: the frontier model tends to surface more edge cases (currency normalisation, disputed invoices, broken promises) and give a cleaner plan. The fast model gives a usable but shallower answer.
- Auto usually lands in the right place without you thinking about it.

## Check it worked

There's nothing to test. Read [`docs/model-selection.md`](../model-selection.md) and compare its guidance with what you just saw.

## Catch up

```bash
git checkout step-4-models
```

## Try it yourself

- Pin a model for a subagent: add `model: inherit` (or a specific model) to the frontmatter of a file in `.cursor/agents/` (you'll create these in step 5).
- Plan with a frontier model in **Plan** mode (`Shift+Tab`), then build the plan with a fast model.
- Run `/best-of-n` with two or three models on the same small task. Each model works in its own worktree, so you can compare the diffs side by side.
