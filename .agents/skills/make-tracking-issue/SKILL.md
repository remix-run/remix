---
name: make-tracking-issue
description: Create or revise a GitHub tracking issue for a Remix change, including the target outcome, implementor context, a concise checkbox plan, compatibility concerns, and required gates. Use when the user asks to open, draft, rewrite, or tighten a tracking issue, implementation issue, umbrella issue, or work plan in the Remix repository.
---

# Make Tracking Issue

## Overview

Create a focused handoff that explains what must change and how completion will be judged without turning the issue into a prescriptive implementation specification.

Use `gh` for GitHub reads and writes. Creating or editing an issue is an external write, so only perform it when the user asks for the issue to be created or updated. Otherwise, return a draft.

## Workflow

1. Inspect the relevant code, package metadata, docs, and existing tests until the current state and affected boundaries are concrete.
2. Capture decisions already made by the user. Do not reopen them as alternatives or weaken them with speculative language.
3. Confirm the target repository from the git remote, search for duplicate issues, and inspect issue templates or labels when they may affect the result.
4. Draft the issue using the structure below, omitting sections that add no value.
5. Create or edit the issue with `gh`, then read it back to verify the title, body, state, and URL.

## Issue Structure

### Title

Name the concrete outcome and affected area. Prefer `Refactor @remix-run/test to ...` over vague titles such as `Improve test architecture`.

### Summary

State the current problem, desired end state, and why the change matters. Include a compact dependency or execution flow when ownership boundaries are central to the work.

### Context and requirements

Give the implementor the non-obvious facts needed to work safely:

- Current and target ownership boundaries
- Public APIs, commands, or package exports that must remain available
- Compatibility and migration expectations
- Dependency-direction constraints
- Defaults or behavior that must not change
- Explicit non-goals

Keep requirements semantic. Avoid locking in exact type shapes, helper names, file layouts, or parsing implementations unless the repository or user has already decided them.

### Implementation plan

Write one flat checklist containing the work outcomes required to complete the change.

- Use checkboxes only in this section.
- Keep each item to one concise sentence.
- Be thorough enough to cover implementation, integration, tests, docs, packaging, and release notes when applicable.
- Describe what must be accomplished, not the exact sequence of edits or internal design.
- Avoid nested checklists, per-file recipes, proposed interfaces, and command-by-command instructions.

Good:

```markdown
- [ ] Move test-command parsing and help behavior into `@remix-run/cli`.
- [ ] Remove the standalone executable and migrate repository consumers.
- [ ] Update integration and packaging coverage for the new boundary.
```

Too prescriptive:

```markdown
- [ ] Add `multiple: true` to `ParseArgsStringOptionSpec` in `parse-args.ts`.
- [ ] Rename `loadConfig(argv, cwd)` to `loadResolvedConfig(options, cwd)`.
```

### Required gates

List acceptance criteria as ordinary bullets, not checkboxes. Cover the narrow package checks and broader repository checks required by `AGENTS.md`, plus meaningful smoke or packaging verification.

Prefer outcome language when the exact command is not important:

```markdown
- Test-package tests, typecheck, and build pass.
- Package metadata validation passes.
- The packed package exposes the intended API and no removed executable.
```

Use exact commands only when they are established repository gates or prevent ambiguity.

### Additional context

Add migration examples, release impact, likely affected areas, or out-of-scope notes only when they materially help implementation. Keep historical changelog entries and unrelated cleanup out of scope unless requested.

## Quality Rules

- Lead with the desired outcome, not a chronology of investigation.
- Separate implementation tasks from acceptance gates.
- Preserve the user's chosen architecture and terminology.
- Distinguish public behavior from internal implementation freedom.
- Call out breaking changes and provide a migration path.
- Do not inflate the issue with exhaustive flag, file, or test-case inventories when a grouped requirement is sufficient.
- Do not add labels merely because they exist; use only labels that accurately communicate repository workflow or ownership.
- Avoid creating a general abstraction as part of a focused tracking issue unless the requested change requires it.

## Before Finishing

- Is the title specific enough to scan in an issue list?
- Can an implementor explain the current state, target state, and ownership boundary after reading the summary?
- Is the implementation plan a single flat checkbox list of outcomes?
- Are gates plain bullets with no checkboxes?
- Are compatibility, migration, release, and non-goal details included only where useful?
- Did `gh issue view` confirm the final issue content and URL?
