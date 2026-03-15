---
name: author-ui-components
description: Author behavior-focused components for packages/ui. Use when building or revising first-party Remix UI components that should lean on shared tokens and mixins, avoid wrapper-heavy as/asChild patterns, coordinate internally with component context, and communicate externally with bubbling DOM event subclasses.
---

# Author UI Components

Use this skill for `packages/ui` components.

## Rules

1. Prefer shared mixins before adding subcomponents.

- If styling, spacing, or simple internal participation can live in `ui.*`, put it there first.
- Add subcomponents only when they carry real structure, semantics, or behavior.

2. Avoid `as`, `asChild`, and wrapper-heavy escape hatches.

- App code and first-party components can compose directly with `mix`.
- Prefer direct host rendering plus mixins over indirection.

3. Use component context for internal coordination.

- Keep internal state, registration, and descendant communication inside component context.
- Treat this as the default path for trigger/item/content-style coordination.

4. Use bubbling custom events for external communication.

- Export an event subclass when outside code needs to observe component behavior.
- Expose an ergonomic static event reference when helpful, for example `Accordion.change`.
- Expect ancestors to listen with `mix={on(Component.event, ...)}`.

5. Use real DOM events.

- Prefer `on(...)`, `pressEvents()`, and native semantics over synthetic abstractions.
- Keep components thin and behavior-focused.

6. Default motion should be snappy.

- Prefer `spring()` as the default animation choice.
- Only reach for named presets or custom spring options when there is a clear reason to slow down, soften, or exaggerate the motion.

## First Reference

- `Accordion` is the first concrete example of this pattern in `packages/ui`.
- When extending this skill later, update it with lessons learned from the real Accordion implementation instead of hypothetical rules.
