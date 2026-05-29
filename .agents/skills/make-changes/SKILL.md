---
name: make-changes
description: Create or update Remix repo change files under `packages/*/.changes`. Use when a user asks for release notes, changes, a missing changelog entry, a prerelease note, or an update to existing unpublished release notes.
---

# Make Changes

## Overview

Write concise release notes that match this repository's `.changes` conventions. Use this skill for both new change files and edits to existing unpublished ones.

## Workflow

1. Read the package's `package.json`, existing `.changes/` directory if present, and any relevant PR diff or commit range.
2. Check whether an unpublished change file already exists for the same work. If it does, update it in place instead of creating a duplicate note.
3. Choose the bump type from the package version and the user-facing impact.
4. Create `packages/<package>/.changes/` on demand if it does not already exist.
5. Write user-facing release notes that describe shipped behavior, APIs, exports, migrations, or upgrade work.
6. Run `pnpm changes:preview` to verify the rendered changelog output.
7. Run lint or broader validation when the task also touched code, package metadata, docs, or release tooling.

## Bump Rules

- For `0.x` packages, use `minor` for new features and breaking changes, and `patch` for bug fixes.
- Do not use `major` for `0.x` packages unless explicitly instructed.
- For `1.x+` packages, use standard semver.
- Breaking changes are relative to `main`, not earlier commits in the same PR.
- In `0.x`, breaking change notes must start with `BREAKING CHANGE: `.
- For `remix` prerelease mode, the bump type mostly controls changelog categorization while the prerelease counter advances.

## Placement And Naming

- Use `packages/<package>/.changes/[major|minor|patch].short-description.md`.
- Keep the slug short, specific, and stable.
- Reuse existing deterministic names when the repo already has a pattern for that class of note.
- For brand-new package releases, prefer `minor.initial-release.md`.
- For Remix export-only changes, update `packages/remix/.changes/minor.remix.update-exports.md` in place.
- When `packages/remix/.changes` mirrors a change file from a re-exported package, name it `packages/remix/.changes/[major|minor|patch].<package>.short-description.md`, where `<package>` omits the `@remix-run/` scope.

## Note Content

- Document user-visible behavior, public API changes, exports, migrations, or upgrade work.
- Do not write release notes for internal refactors unless they surface as real API or behavior changes.
- Keep each note self-contained. A reader should understand the shipped behavior from the note itself, with links adding context rather than replacing the explanation.
- When a change is tied to a public issue, PR, RFC, decision doc, spec, or external bug report, include a short reference in the note. Prefer the PR that actually addressed the issue or feature over the source issue because the source issue remains reachable from the PR. Use inline same-repo references like `(see #1234)` and full URLs for external repositories, specs, or reports.
- Name the affected API, route convention, package, entrypoint, runtime, browser, or tool version when that detail helps users recognize whether the note applies to them.
- For bug fixes, describe the user-visible symptom or failing scenario instead of only describing the implementation fix.
- For breaking changes, include the old behavior, new behavior, and migration path.
- For deprecations, mention the replacement API when one exists.
- Avoid linking every implementation PR when it does not add useful reader context.
- Prefer a small number of logically grouped notes over many tiny files.
- Do not manually hard-wrap prose in `.changes/*.md` files. Keep each paragraph or bullet on a single source line and let rendered changelogs wrap naturally.
- Use flat bullets only when they add clarity. Short paragraphs are usually better.
- Do not edit historical `CHANGELOG.md` entries unless explicitly asked, except for narrow corrections such as broken links, typos, or clearly invalid references.

## Detail Levels

- Package-level change files are the source of truth. For sub-packages, include the concrete API, behavior, runtime, or tooling details users need to understand the change.
- Include before/after examples in sub-package notes when they clarify a new API, migration, breaking change, or changed usage pattern.
- Include useful PR, issue, RFC, decision, spec, or external report links in sub-package notes. Prefer the implementation PR when it gives readers the full trail.
- `packages/remix/.changes` entries should read like an umbrella release summary for `remix` users. Keep them shorter than the underlying package notes and focus on the surfaced `remix/...` entrypoints or release-level impact.
- Do not duplicate detailed examples, migration prose, or implementation background from a sub-package note into the `remix` note unless the umbrella package itself changes behavior.
- When a `remix` note summarizes a sub-package change, link to the lower-level changelog, release, PR, or other durable detail source when that helps readers drill down.
- The release tooling already adds dependency bump links to released package tags, so do not manually recreate dependency bump lists in `remix` change files.

## Package Ownership

- Add a manual change file to the package that owns the changed API, behavior, or implementation.
- If another package directly re-exports a newly added, removed, renamed, or otherwise changed public API surface, add a change file for the re-exporting package when users can consume that API through the re-exported entrypoint.
- Do not add manual change files recursively for packages that only observe a change through dependency updates. The release scripts already include transitive dependents and generate dependency bump changelog entries.
- For bug fixes in an underlying package, usually add a change file only to the package that owns the fix. Add a re-export package note only when the re-exporting package's own changelog needs to call out the behavior directly, not merely because the fixed dependency is reachable from that package.

## Remix-Specific Rules

- `packages/remix/src/*` re-export files are generated. Do not hand-edit them unless the task explicitly requires generated output.
- When `packages/remix/package.json` gains or changes public exports, capture that in `minor.remix.update-exports.md` instead of inventing a one-off filename.
- If the change exposes another package's new APIs through `remix/...`, describe the surfaced `remix/...` entrypoints, not just the underlying workspace package name.

## Before Finishing

- Did you inspect existing unpublished `.changes` files first?
- Does the note describe user-facing changes instead of implementation details?
- Did `pnpm changes:preview` render the expected changelog entry?
