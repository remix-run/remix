---
name: make-change-file
description: Create or update Remix repo change files under `packages/*/.changes`. Use when a user asks for release notes, a change file, a missing changelog entry, a prerelease note, or an update to existing unpublished release notes.
---

# Make Change File

## Overview

Write release notes that match this repository's `.changes` conventions. Use it for both new change files and edits to existing unpublished ones.

## Workflow

1. Read the package's `package.json`, `.changes/` directory, and any relevant PR diff or commit range before writing anything.
2. Check whether an unpublished change file already exists for the same work. If it does, update it in place instead of creating a duplicate note.
3. Choose the bump type from the package version and the user-facing impact.
4. Write concise, user-facing release notes that describe shipped behavior, APIs, or exports.
5. Run `pnpm changes:preview` to verify the rendered changelog output.
6. Run `pnpm run lint` before finishing.

## Naming

- Use `packages/<package>/.changes/[major|minor|patch].short-description.md`.
- Keep the slug short, specific, and stable.
- Reuse existing deterministic names when the repo already has a pattern for that class of note.
- For Remix export-only changes, update `packages/remix/.changes/minor.remix.update-exports.md` in place.
- For brand-new package releases, prefer `minor.initial-release.md`.

## Bump Rules

- For `0.x` packages: use `minor` for new features and breaking changes, `patch` for bug fixes.
- Do not use `major` for `0.x` packages unless explicitly instructed.
- For `1.x+` packages: use standard semver.
- Breaking changes are relative to `main`, not relative to earlier commits in the same PR.
- In `0.x`, breaking change notes must start with `BREAKING CHANGE: `.
- For `remix` prerelease mode, the bump type mostly controls changelog categorization while the prerelease counter advances.

## Content Rules

- Document user-visible behavior, public API changes, exports, migrations, or upgrade work.
- Do not write release notes for internal refactors unless they surface as real API or behavior changes.
- Prefer a small number of logically grouped notes over many tiny files.
- If one package changes internally and another package re-exports the new surface, add notes for both when users can consume the change from both package entrypoints.
- Do not manually hard-wrap prose in `.changes/*.md` files. Keep each paragraph or bullet on a single source line and let rendered changelogs wrap naturally.
- Use flat bullets only when they add clarity. Short paragraphs are usually better.

## Remix-Specific Rules

- `packages/remix/src/*` re-export files are generated. Do not hand-edit them unless the task explicitly requires generated output.
- When `packages/remix/package.json` gains or changes public exports, capture that in `minor.remix.update-exports.md` instead of inventing a one-off filename.
- If the change exposes another package's new APIs through `remix/...`, describe the surfaced `remix/...` entrypoints, not just the underlying workspace package name.

## Checklist

- Did you inspect existing unpublished `.changes` files first?
- Is the bump type correct for the package version?
- Did you reuse any deterministic filename the repo already expects?
- Does the note describe user-facing changes instead of implementation details?
- Does each paragraph or bullet stay on one source line without manual hard wrapping?
- Did `pnpm changes:preview` render the expected changelog entry?
