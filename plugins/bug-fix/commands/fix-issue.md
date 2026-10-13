---
name: fix-issue
description: Fix a GitHub issue end to end. Reads the issue, writes or finds a failing test, fixes the root cause, runs the checks and opens a pull request that closes the issue. Usage /fix-issue <issue number or URL>
---

# Fix a GitHub issue

Fix the GitHub issue given after the command (a number like `12`, `#12`, or a full issue URL). If no issue was given, list the open issues labelled `bug` in this repository and ask which one to fix.

Follow the `fix-github-issue` skill from this plugin, step by step and in order:

1. Read the issue and its comments.
2. Reproduce the bug with a failing test before changing any application code.
3. Fix the root cause with the smallest reasonable change.
4. Run the project's checks until they pass.
5. Commit on a `fix/issue-<number>-<slug>` branch, push it, and open a pull request whose body contains `Fixes #<number>`.
6. Report back as described in the skill's last step.
