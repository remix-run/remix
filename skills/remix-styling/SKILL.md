---
name: remix-styling
description: Style Remix UI with `remix/component` CSS patterns. Use when changing layout, spacing, colors, typography, responsive behavior, hover/focus states, or visual polish.
---

# Remix Styling

Use this skill for styling Remix UI: layout, spacing, colors, typography, responsive behavior, and
visual states.

Use `../remix-ui/SKILL.md` as well when the task also changes component behavior, hydration, or
client-side interaction.

## Defaults

1. Prefer `css(...)` via `mix` for static styles, selectors, pseudo-states, and media queries.
2. Use `&` for pseudo-states and attribute selectors such as `&:hover`, `&:focus`, and
   `&[aria-current="page"]`.
3. Use descendant selectors when parent state affects children instead of creating JavaScript state
   only for styling.
4. Use `style` only for dynamic values that change frequently.
5. Keep styles in the narrowest owner first:
   - route-owned UI stays with the route
   - shared cross-route UI belongs in `app/ui/`
6. After styling, verify hover, focus, active, hidden, empty, and responsive states.

## Load This Reference As Needed

- [./references/css-patterns.md](./references/css-patterns.md)
  Use for `css(...)` patterns, selectors, responsive rules, ownership guidance, and state-focused
  verification.
