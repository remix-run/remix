# Open Questions

## Current

- How far should `ui.surfaceText.*` go before we introduce more contextual families like `ui.menuText.*` or `ui.fieldText.*` expansions?
- Which layout primitives are most worth adding first?
  - stack
  - cluster
  - inline
  - container

## Deferred

- Add shared interactive row/item recipes beyond the current first pass.
  - useful for tabs, menus, combobox options, command items, navigation rows
- Add a few more structural recipes for list/menu/select-style items.
- Introduce a slightly more semantic text scale.
  - likely roles like caption, sectionTitle, and code/mono on top of body, label, title, and display
- Validate the abstraction with an alternate scoped theme.
  - use a second theme or scoped theme variant to confirm recipes actually adapt cleanly

## Long-Term Shape

If this becomes a comprehensive design system, the likely layering is:

- primitive tokens
  - size, weight, line height, tracking, family, color, spacing, radius, and control sizing
- semantic text styles
  - body, bodySm, label, caption, title, display, and code
- contextual composition recipes
  - surface text, field text, menu text, item rows, controls, surfaces, statuses, and layout primitives

## Guardrails

- Do not confuse demo-specific recipes with final design-system taxonomy.
- Keep the system focused on helping first-party components and Remix app code share the same language.
