---
name: update-pr
description: Update an existing GitHub pull request title and description so they accurately describe the pull request as it exists now. Use when the user asks to update, rewrite, refresh, fix, or tighten a PR title/body, or when the PR scope has changed and the metadata needs to be brought back in sync.
---

# Update PR

## Overview

Rewrite pull request metadata as if drafting it from scratch for the current diff. Treat the title and body as a current reviewer-facing summary of the final net-new feature or bug fix in the PR, not as commentary about prior versions of the PR or the path taken to get there.

## Workflow

1. Read the current PR title/body and the current branch diff before drafting.
2. Identify the PR's current net-new scope, APIs, behavior changes, and reviewer-relevant context.
3. Rewrite the body from scratch so it describes the shipped feature/fix as it exists now.
4. Review the title at the same time and update it whenever the body is updated.
5. Apply the update with `gh pr edit`.

## Rules

- Never write the description as an update to itself. Do not say things like "this expands the original PR", "this PR now also", or similar process narration unless the user explicitly wants history called out.
- Describe the net-new feature or bug fix, not the implementation journey. Do not call out intermediate cleanup, refactors, rewrites, or iteration details unless they are necessary to understand the final delivered behavior.
- Always evaluate the title when updating a PR. If the scope or emphasis changed, rewrite the title too.
- Write in terms of the present PR contents, using concise reviewer-facing language.
- For feature PRs, focus the summary on what Remix gains: new packages, public APIs, behaviors, integrations, and documentation. Do not spend bullets on test additions, cleanup work, or internal restructuring unless those are themselves a meaningful part of the shipped feature.
- For bug-fix PRs, focus the summary on the bug, the fix, and any user-visible behavior change. Do not narrate the debugging process or incidental refactors.
- Keep the structure minimal: one short introductory paragraph plus flat bullets is usually enough.
- Include usage examples when the PR introduces or materially changes a feature API.
- Preserve still-relevant issue links or context, but drop stale framing.

## Applying The Update

- Draft the new title and body in a temporary file.
- Use `gh pr edit <number> --title "<title>" --body-file <file>`.
- Re-read the PR after editing to confirm the final title/body match the intended framing.
