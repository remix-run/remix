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
- Expand the animation recipe family beyond `ui.animation.spin`.
  - likely next candidates: `ui.animation.pulse`
  - likely needs a small demo/reference section so motion primitives are visible in context
  - worth exploring a few calm, utilitarian motion recipes rather than one-off animation classes
- Add a first-party `Spinner` component.
  - should wrap the shared spinner glyph and motion token rather than inventing a separate visual language
  - should help prove the relationship between glyphs, icon sizing, and animation recipes
- Add an `ActionButton` component with loading-state ergonomics.
  - should show a spinner and move through useful loading states rather than leaving each call site to reinvent that pattern
  - good candidate for proving thin component ergonomics on top of `ui.button.*`, glyphs, and motion recipes
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
