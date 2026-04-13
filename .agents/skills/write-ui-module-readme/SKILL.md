---
name: write-ui-module-readme
description: Write concise module README files for `packages/ui/src/lib/*` primitives. Use when drafting or revising README docs for UI package modules like popover, press, or other first-party UI helpers, especially when the main goal is agent-friendly usage guidance and a short explanation of each exported value.
---

# Write UI Module Readme

## Overview

Write module README files for `packages/ui/src/lib/*` as practical usage guides for agents and developers.

Optimize for fast, correct adoption:

- show the canonical usage first
- explain each exported `module.*` value briefly
- document the important behavior guarantees
- avoid implementation-history dumps and internal type walkthroughs

These are module docs for UI primitives, not package-level READMEs.

## Workflow

1. Read the module source first.

- Identify the actual public exports and their roles.
- Confirm the behavior from code, not memory.

2. Read nearby tests and demos.

- Pull behavior notes from tests.
- Reuse the most realistic example shape from a demo when available.

3. Document the module as it exists today.

- Do not describe planned APIs.
- Do not document internal coordinators, private state, or workaround history unless they are part of the public contract.

4. Keep the README short and scannable.

- Prefer short paragraphs and flat bullets.
- Use one strong canonical example instead of multiple weak snippets.

## Recommended Structure

Use this structure unless the module needs something more specific:

1. `# ModuleName`
2. One or two sentences: what it is, what it is for, and what it is not for
3. `## Usage`
4. `## \`module.*\`` or equivalent export reference
5. `## Behavior Notes`
6. `## When To Use Something Else` when the primitive sits below higher-level widgets

## Usage Section

Lead with a copy-pasteable example that shows the real shape of usage.

- Prefer production-shaped UI over toy snippets.
- Use the actual exported API names.
- Show the minimum surrounding structure needed to use the primitive correctly.
- If the module composes with other first-party UI helpers, show that composition.

For popup-style primitives, the example should usually show:

- trigger
- surface/root
- one or two meaningful controls inside
- dismissal or completion path

## Export Reference

After the example, explain the role of each important exported value in a few lines each.

For example:

- `module.context`: what shared coordination it provides
- `module.button(...)`: what it registers or activates
- `module.surface()`: what it turns the host into
- `module.dismiss()`: how it closes or finalizes
- `module.change`: what event it emits and the useful event fields

Keep this section focused on:

- what it does
- where to apply it
- key arguments or options
- observable behavior

Do not turn this into a full API dump.

## Behavior Notes

Document the behaviors that matter when composing with the primitive:

- focus movement
- dismissal rules
- anchoring rules
- keyboard behavior
- multi-trigger behavior
- any important guarantees tested in the module suite

This section should save a reader from opening the implementation just to answer “what happens when...?”

## Scope Rules

- Treat the primary audience as an agent or developer trying to use the primitive correctly.
- Prefer usage guidance over architecture explanation.
- Name public events and useful event fields, but avoid deep event-class internals unless necessary.
- Do not document private classes, internal coordinators, or helper mixins unless the README is specifically for that helper.
- Do not pad the README with generic accessibility or popover theory the agent already knows.

## Good Patterns

- “Use `popover` directly for custom floating panels like filters or view options.”
- “Wrap triggers and the surface in `popover.context`.”
- “The opener that started the current session controls anchoring and focus return.”
- “Do not use this as the final consumer-facing primitive for menus or comboboxes.”

## Checklist

- Did you read the module source first?
- Did you confirm behavior from tests or demos?
- Does the README start with a realistic usage example?
- Does it explain each important exported value briefly?
- Does it include behavior notes that matter in practice?
- Does it avoid internal implementation detail and historical debugging context?
- Would an agent know how to use the primitive correctly without opening the source?
