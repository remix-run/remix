---
name: make-pr
description: Create GitHub pull requests with clear, reviewer-friendly descriptions. Use when asked to open or prepare a PR, especially when the PR needs strong context, related links, and feature usage examples. This skill enforces concise PR structure, avoids redundant sections like validation/testing, and creates the PR with gh CLI.
---

# Make PR

## Overview

Use this skill to draft and open a PR with consistent, high-signal writing.
Keep headings sparse and focus on the problem/feature explanation, context links, and practical code examples.
Optimize for the shortest path to a credible PR, not the fullest possible context-gathering pass.

## Workflow

1. Check the fast-path blockers first.

- Check `git status --short --branch` and `git branch --show-current` before doing deeper prep.
- If the repo is in a detached HEAD or worktree state and the user wants a PR opened, create a branch early.

1. Gather only the context needed to write the PR.

- Capture what changed, why it changed, and who it affects.
- Find related issues/PRs and include links when relevant.
- Prefer `git diff --stat` plus the relevant diff over broad repo archaeology when the change is small.
- If the user supplies a report, issue, or related PR, treat that as the primary context source.

1. Get the branch into a PR-ready state quickly.

- If changes are still uncommitted and the user wants a PR, branch first, then commit.
- Prefer a single clean commit unless the user asks for a different history shape.

1. Check whether this PR also needs a change file.

- Do not assume every PR needs one.
- Before opening the PR, decide whether the change is user-facing enough to require release notes in `packages/*/.changes`.
- If a change file is needed or likely needed, use the `make-change-file` skill instead of re-deriving that workflow here.

1. Draft the PR body with minimal structure.

- Start with 1-2 short introductory paragraphs.
- After the intro, include clear bullets describing:
  - the feature and/or issue addressed
  - key behavior/API changes
  - expected impact
- If the change is extensive, expand to up to 3-4 paragraphs and include background context with related links.

1. Add required usage examples for feature work.

- If the PR introduces a new feature, include a comprehensive usage snippet.
- If it replaces or improves an older approach, include before/after examples.

1. Exclude redundant sections.

- Do not include `Validation`, `Testing`, or other process sections that are already implicit in PR workflow.
- Do not add boilerplate sections that do not help review.

1. Create the PR.

- Save the body to a temporary file and run:

```bash
gh pr create --base main --head <branch> --title "<title>" --body-file <file>
```

- If `gh pr create` fails, leave the branch pushed when possible and give the user a ready-to-open compare URL plus the prepared title/body details.

## Body Template

Use this as a base and fill with concrete repo-specific details:

````md
<One or two short intro paragraphs explaining the change and why it matters.>

- <Feature/issue addressed>
- <What changed in behavior or API>
- <Why this is needed now>

<Optional additional context paragraph(s), up to 3-4 total for large changes, including links to related PRs/issues.>

```ts
// New feature usage example
```

```ts
// Before
```

```ts
// After
```
````
