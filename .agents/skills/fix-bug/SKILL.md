---
name: fix-bug
description: Fix a reported bug in Remix from a GitHub issue. Use when the user provides a GitHub issue URL and asks to fix a bug, investigate an issue, or reproduce a problem. Handles the full workflow: fetching the issue, finding the reproduction, writing a failing test, and implementing the fix.
disable-model-invocation: true
---

# Fix Remix Bug

Fix the bug reported in the following GitHub issue: $ARGUMENTS

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
- Remix version and which package(s) are involved (e.g., `remix/fetch-router`, `remix/route-pattern`, `remix/cli`)
- Any code snippets in the issue
- Links to reproductions (StackBlitz, CodeSandbox, GitHub repo, etc.)

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

If the fix is user-facing, add a change file under `packages/<package>/.changes/`. Use the `make-change-file` skill at `.agents/skills/make-change-file/SKILL.md` — do not re-derive the naming, bump rules, or content rules here.

For `0.x` packages, bug fixes are `patch`. For Remix export-only changes, update `packages/remix/.changes/minor.remix.update-exports.md` in place.

### 7. Report Results

Summarize:

- What the bug was and why it happened
- What code was changed and why
- That the test now passes
- Any edge cases or related issues noticed

Ask me to review the changes and iterate based on any feedback.

### 8. Open PR

Once I approve the fix, commit the changes and open a PR to `main`. Use the `make-pr` skill at `.agents/skills/make-pr/SKILL.md` for the PR body and command. Include `Closes #NNNN` in the description to link the PR to the original issue, and link the issue in the `Development` sidebar.
