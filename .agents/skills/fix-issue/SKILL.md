---
name: fix-issue
description: |
  Fix a reported issue in Remix from a GitHub issue. Use when the user provides a GitHub issue URL and asks to fix a bug, investigate an issue, reproduce a problem, or complete part of a tracking issue. Handles the full workflow: fetching the issue, finding the reproduction, writing a failing test, implementing the fix, and recording merged progress on tracking-issue checklists.
disable-model-invocation: true
---

# Fix Remix Issue

Fix the issue reported in the following GitHub issue: $ARGUMENTS

## Branching

Bug fixes should start from a clean working tree. If there are changes, prompt me to resolve them before continuing.

Bugs should be fixed from `main` in a new branch using the format `{author}/{semantic-branch-name}` (i.e., `brophdawg11/fix-route-pattern`):

```sh
git fetch origin main
git branch {author}/{semantic-branch-name} origin/main
git checkout {author}/{semantic-branch-name}
```

## Workflow

### 1. Fetch and Understand the Issue

Use `gh issue view <number> --repo remix-run/remix` or `WebFetch` to read the full issue.

Extract:

- Bug description and expected vs actual behavior
- Remix version and which package(s) are involved (e.g., `remix/router`, `remix/route-pattern`, `remix/cli`)
- Any code snippets in the issue
- Links to reproductions (StackBlitz, CodeSandbox, GitHub repo, etc.)
- Any implementation-plan checkboxes and the merged PRs already linked from them

If the issue contains implementation-plan checkboxes, treat it as a tracking issue and its checklist as the durable progress record:

- Do not redo checked work. Confirm linked PRs with `gh pr view <number> --repo remix-run/remix --json state,mergedAt,url` when their status matters.
- Choose one coherent set of unchecked items for the current PR. Do not expand the PR merely to finish the entire issue; long plans may require several PRs.
- State which checklist items the current PR intends to complete and which will remain for later work.

### 2. Validate the Reproduction

**If there's a StackBlitz/CodeSandbox/online sandbox link:**

- Use `WebFetch` to read the sandbox URL and extract the relevant code
- Identify the exact sequence of events that triggers the bug

**If there's a GitHub repository link:**

- Use `WebFetch` to read key files (`package.json`, relevant source files) from the raw GitHub URL
- Identify the reproduction architecture - routes, router, middleware, controllers, components, etc.

**If no reproduction link exists:**

- Search the issue comments with `gh issue view <number> --repo remix-run/remix --comments`
- Look for code snippets in comments
- Ask the user: "No reproduction was provided. Can you share a minimal reproduction or paste the relevant code?"

### 3. Identify the Affected Code

Remix is a pnpm monorepo with most product code under `packages/<name>/src/`. Each `exports` entry in a package's `package.json` maps to a top-level `src/*.ts` file; implementation lives in `src/lib/`. Use `Grep`, `Glob`, and the LSP tools to trace the relevant code paths and locate the owning package. See `AGENTS.md` for repo shape and cross-package import rules.

If the bug spans multiple packages, prefer fixing it in the owning package and avoid re-exporting the fix from another package.

### 4. Write a Failing Test

Tests are colocated with source as `src/**/<name>.test.ts` and run from source (no build step). Match the patterns in nearby test files and follow the conventions in the `write-tests` skill at `.agents/skills/write-tests/SKILL.md`.

Run a single test file inside the owning package:

```sh
cd packages/<package> && pnpm test src/**/<filename>.test.ts
```

Or use the changed-workspace runner (diffs against `origin/main`, includes uncommitted changes):

```sh
pnpm run test:changed
```

Write the test to **reproduce the bug exactly** — it must fail before the fix. Run it and confirm it fails.

### 5. Implement the Fix

- Make the minimal change needed to fix the bug
- Do not refactor unrelated code
- Confirm the fix addresses the root cause, not just the symptom
- Honor the platform stance: prefer Web APIs and standards-aligned primitives over Node-specific APIs
- Do not add cross-package re-exports or barrels in `src/lib`

Run the failing test again — it must now pass. Then validate locally:

```sh
pnpm run lint
pnpm run typecheck:changed
pnpm run test:changed
```

For broad cross-workspace changes, shared root config changes, or anything that could affect the whole repo, run the full validation:

```sh
pnpm test
pnpm run typecheck
```

### 6. Create a Change File

If the fix is user-facing, create `packages/<package>/.changes/` on demand and add a change file there. Use the `make-changes` skill at `.agents/skills/make-changes/SKILL.md` — do not re-derive the naming, bump rules, or content rules here.

For `0.x` packages, bug fixes are `patch`. For Remix export-only changes, update `packages/remix/.changes/minor.remix.update-exports.md` in place.

### 7. Report Results

Summarize:

- What the bug was and why it happened
- What code was changed and why
- That the test now passes
- Any edge cases or related issues noticed
- For a tracking issue, which checklist items this PR completes and which items remain unchecked

Ask me to review the changes and iterate based on any feedback.

### 8. Open PR

Once I approve the fix, commit the changes and open a PR to `main`. Use the `make-pr` skill at `.agents/skills/make-pr/SKILL.md` for the PR body and command, and link the issue in the `Development` sidebar.

- For a regular issue, include `Closes #NNNN` in the description.
- For a tracking issue, use `Part of #NNNN` instead. Never use a closing keyword while any implementation-plan checkbox is unchecked.

### 9. Record Merged Tracking-Issue Progress

Update a tracking issue only after the corresponding PR has merged:

1. Verify the PR has a non-null `mergedAt` with `gh pr view <number> --repo remix-run/remix --json number,url,state,mergedAt`.
2. Fetch the issue body again immediately before editing so concurrent progress is preserved.
3. For each checklist item fully completed by the PR, preserve its wording, change `[ ]` to `[x]`, and append a Markdown link to the merged PR, for example `([#1234](https://github.com/remix-run/remix/pull/1234))`.
4. If a merged PR advances an item without completing it, append the PR link but leave the item unchecked. Check it only when its stated outcome is fully complete; include every merged PR needed to document the completed work.
5. Edit the issue with `gh issue edit <number> --repo remix-run/remix --body-file <file>`, then read it back with `gh issue view` and verify the checklist, links, and issue state.

If unchecked items remain, leave the tracking issue open and report the remaining items so another agent can continue from the issue. Before closing, fetch the current body once more and scan it for unchecked task-list items. If none remain, verify that every checked item links to the merged PR or PRs that completed it, then close the issue explicitly with `gh issue close <number> --repo remix-run/remix`. Never close a tracking issue with unchecked implementation-plan boxes.

If the workflow ends before the PR merges, leave its boxes unchecked and report that updating the tracking issue after merge is still required. Do not cite an open, draft, or closed-unmerged PR as completed work.
