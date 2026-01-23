# Task Workflow

This document describes how to use the `tasks/` directory structure for managing development work.

## Directory Structure

```
tasks/
├── workflow.md          # This file
└── {feature}/           # One directory per feature/project
    ├── plan.md          # High-level architecture and design decisions
    ├── todo.md          # Upcoming tasks (backlog)
    ├── in-progress.md   # Currently active work
    └── done/            # Completed tasks (numbered for history)
        ├── 001-task-name.md
        ├── 002-another-task.md
        └── ...
```

## File Purposes

### `plan.md`

High-level architecture, design decisions, and goals. This is the "why" and "what" - the vision for the feature. Update this when fundamental decisions change.

### `todo.md`

The backlog of upcoming work. Tasks here are defined but not yet started. Include:

- Clear task title
- Problem/context (if not obvious)
- Acceptance criteria with checkboxes
- Keep the most important/blocking tasks at the top

### `in-progress.md`

Currently active work. Should contain only tasks being actively worked on. Each task includes:

- **Implementation status** - Checkboxes tracking progress
- **Discovered requirements** - New requirements found during implementation
- **Remaining** - What's left to do

### `done/`

Completed tasks, numbered sequentially (e.g., `001-scaffold-package.md`). These serve as a historical record and can be referenced later. Keep them concise - just enough to understand what was done and why.

## Workflow

### Starting Work

1. Pick a task from `todo.md`
2. Move it to `in-progress.md`
3. Begin implementation

### During Implementation

- Update `in-progress.md` as you go:
  - Check off completed items
  - Add discovered requirements
  - Note decisions made
- If you discover the task is fundamentally different than expected, update the task description
- If you discover new tasks, add them to `todo.md`
- If a task grows too large, split it and move parts back to `todo.md`
- **Update `plan.md` if any design details change** - the plan should always reflect the current implementation, not outdated decisions

### Completing Work

1. Verify all acceptance criteria are met (tests pass, demo works, etc.)
2. **Confirm with the user before marking done** - they may want to review, make tweaks, or run manual tests
3. Once confirmed, move the task from `in-progress.md` to `done/` with the next sequence number
4. Clean up the done file - keep it concise, remove WIP notes

### Key Principles

**Tasks should be end-to-end verifiable.** Don't mark a task "done" until you can see it working in the demo app or tests. An API without integration isn't done - it's just implemented.

**Update tasks as you learn.** Requirements change during implementation. Keep the task doc in sync with reality. Add "Discovered requirements" to capture learnings.

**Keep tasks focused.** If a task balloons in scope, split it. It's better to have multiple small completed tasks than one large incomplete one.

**The demo is the test.** Unit tests verify implementation, but the demo app verifies the design is actually useful. If you can't use it in the demo, something's wrong.

**Don't prematurely split tasks.** Keep related work together so you get the feedback loop. "Create API" + "Integrate API" should often be one task, not two.
