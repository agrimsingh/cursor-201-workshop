#!/usr/bin/env bash
# Creates the workshop issues on a GitHub repository from .github/ISSUE_TEMPLATE:
# the planted filter bug (label "bug") and the nine homework tasks (label "homework").
#
# Usage: scripts/create-workshop-issues.sh [owner/repo]
# Needs the GitHub CLI (`gh auth login`) with permission to create issues and labels.
# Safe to re-run: issues whose title already exists are skipped.
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
dir="$(cd "$(dirname "$0")/.." && pwd)/.github/ISSUE_TEMPLATE"

gh label create homework --repo "$repo" --color 7c5cff --description "Cursor 201 follow-up task" 2>/dev/null || true
gh label create bug --repo "$repo" --color d73a4a --description "Something isn't working" 2>/dev/null || true

existing="$(gh issue list --repo "$repo" --state all --limit 200 --json title -q '.[].title')"

for file in "$dir"/filter-bug.md "$dir"/homework-*.md; do
  title="$(sed -n 's/^title: "\(.*\)"$/\1/p' "$file" | head -1)"
  label="$(sed -n 's/^labels: \["\([^"]*\)".*$/\1/p' "$file" | head -1)"
  if grep -Fxq "$title" <<<"$existing"; then
    echo "skip   $title"
    continue
  fi
  body="$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2' "$file")"
  url="$(gh issue create --repo "$repo" --title "$title" --label "$label" --body "$body")"
  echo "create $url"
done
