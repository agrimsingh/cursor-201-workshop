# Bug Fix plugin

A Cursor plugin that takes a GitHub issue from report to pull request.

| Component | Path | What it does |
| --- | --- | --- |
| Command | `commands/fix-issue.md` | `/fix-issue <number or URL>`: the entry point |
| Skill | `skills/fix-github-issue/SKILL.md` | The step-by-step workflow: read the issue, reproduce with a failing test, fix, verify, open a PR |

It reads issues and opens pull requests through the **GitHub MCP server** and falls back to the `gh` CLI if that isn't connected.

## Install locally

```bash
mkdir -p ~/.cursor/plugins/local
cp -R plugins/bug-fix ~/.cursor/plugins/local/bug-fix
```

Then run **Developer: Reload Window** in Cursor and check that `fix-issue` shows up under **Customize**. Copy the folder rather than symlinking it: Cursor skips symlinks that point outside `~/.cursor/plugins/local`.

On Teams and Enterprise plans, your admin must allow local plugins (**Dashboard → Settings → Security & Identity → Marketplace and Plugins → Allow Local Plugin Imports**).

## Distribute to a team

This repository has a `.cursor-plugin/marketplace.json` at its root, so a Teams or Enterprise admin can import it as a **Team Marketplace** (**Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace → Import from Repo**) and choose whether the plugin is **Default Off**, **Default On** or **Required** for everyone.

## Use

```
/fix-issue 1
/fix-issue https://github.com/<you>/cursor-201-workshop/issues/1
```
