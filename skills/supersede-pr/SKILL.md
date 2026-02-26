---
name: supersede-pr
description: Safely replace one GitHub pull request with another. Use when a user says a PR supersedes/replaces an older PR, asks to auto-close a superseded PR, or needs guaranteed closure behavior after merge. This skill explicitly closes the superseded PR with gh CLI and verifies final PR states instead of relying on closing keywords.
---

# Supersede PR

## Overview

Use this skill to handle PR supersession end-to-end.
Do not rely on `Closes #<number>` to close another PR. GitHub closing keywords close issues, not pull requests.

## Workflow

1. Identify PR numbers and target repo.
- Capture `old_pr` (the superseded PR) and `new_pr` (the replacement PR).
- Resolve the repo with `gh repo view --json nameWithOwner -q .nameWithOwner` when not provided.

1. Create or update the replacement PR first.
- Open/push the replacement branch.
- Open the new PR.
- Include a traceable link in the PR body such as `Supersedes #<old_pr>`.

1. Close the superseded PR explicitly.
- Run:
```bash
./skills/supersede-pr/scripts/close_superseded_pr.ts <old_pr> <new_pr>
```
- This adds a comment (`Superseded by #<new_pr>.`) and closes the old PR.

1. Verify states.
- Confirm the superseded PR is closed:
```bash
gh pr view <old_pr> --json state,url
```
- Confirm the replacement PR status/checks:
```bash
gh pr checks <new_pr>
```

## Rules

1. Do not use `Closes #<old_pr>` when `<old_pr>` is a pull request.
- Use `Closes/Fixes` only for issues.
- Use `Supersedes #<old_pr>` or `Refs #<old_pr>` for PR-to-PR linkage.

1. Prefer explicit closure over implied automation.
- Always run the close command when the user asks to supersede a PR.
- Treat closure as incomplete until `gh pr view <old_pr>` returns `CLOSED`.

## Script

Use the bundled script for deterministic closure:
- `scripts/close_superseded_pr.ts`
