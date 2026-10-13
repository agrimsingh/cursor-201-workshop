# Choosing a model

Cursor gives you three kinds of choice: a **fast** model, a **frontier** model, or **Auto**. None is "best". Each is the right tool for a different kind of work. This page is a rule of thumb for picking, based on the Tally codebase.

## The short version

| Situation | Pick | Why |
| --- | --- | --- |
| You know exactly what to change and where (rename, copy tweak, add a field, fix a failing assertion) | **Fast** | The thinking is done; speed and tight iteration matter most. |
| Exploring, asking "how does this work?", small multi-file edits with clear instructions | **Auto** | Cursor routes to a model that fits the request; you don't have to decide. |
| Ambiguous problems, design questions, cross-cutting changes, subtle bugs, plans for parallel work | **Frontier** | Deeper reasoning pays off when the hard part is deciding *what* to do. |
| Reviewing a diff for correctness against rules | **Frontier** (or a different model from the one that wrote it) | A second, stronger opinion catches what the author missed. |
| Bulk, repetitive edits across many files that follow one clear pattern | **Fast**, often as parallel subagents | The pattern is the plan; throughput wins. |

If you're unsure, start with **Auto**. Switch when you notice a pattern: lots of follow-ups means you need more reasoning; waiting on obvious edits means you need more speed.

## Signals you need a stronger model

- The first answer misses an edge case you had to point out, twice.
- The change touches several layers (domain, service, API, UI) and has to stay consistent.
- The task involves money, state machines, permissions or concurrency, where a subtle mistake is expensive.
- You're writing a **plan** that other agents will follow. A good plan makes everything downstream cheaper.
- The agent keeps "fixing" a test by changing the test.

## Signals a faster model is enough

- You can describe the change in one or two sentences, and you've @-mentioned the files.
- There's a test that tells you when you're done.
- You're iterating on UI copy, styles or small refactors and want quick turns.
- The work is a mechanical follow-up to a plan a stronger model already wrote.

## Patterns that work well

- **Plan strong, build fast.** Use a frontier model in **Plan** mode to produce the plan (see `.cursor/plans/resolve-dispute.md`), then build each workstream with a faster model.
- **Different model for review.** Give the `reviewer` subagent (`.cursor/agents/reviewer.md`) a different model from the one that wrote the code. Set `model:` in its frontmatter; `inherit` uses the parent's model.
- **Best of N for uncertain tasks.** When you aren't sure which approach is right, run the same prompt across two or three models with `/best-of-n` (each in its own worktree) and keep the best diff.
- **Context beats horsepower.** A fast model with the right `@` files and a clear rule often beats a frontier model guessing across the whole repo. Fix context first (step 1), then reach for a bigger model.

## How to switch

- **Per chat:** use the model picker under the chat input, or press `Cmd+/` / `Ctrl+/` to cycle. The new model applies from the next message.
- **Default:** **Cursor Settings → Models**.
- **Auto:** select **Auto** in the picker.
- **Per subagent:** the `model:` field in `.cursor/agents/<name>.md`.

Model names and availability change often, and some options depend on your plan. Treat this page as a way of thinking about the choice rather than a list of specific models.
