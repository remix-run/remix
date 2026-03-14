# Theme Package Memory

## Current objective

Build a theming package for Remix that works for both:

- app-level Remix code
- future first-party Remix UI components

The core model is:

- `theme` is a typed contract of CSS custom properties
- `createTheme(values)` renders a `<style>` tag defining those variables
- both app code and first-party components consume `theme.*` variable references
- `ui` provides composable `css()` recipes built on top of the token contract

## Current state

Implemented in `packages/theme`:

- typed token contract via `theme`
- `createTheme()` renderer
- `RMX_01` preset and `RMX_01_VALUES`
- utility scales like spacing, radii, colors, shadows
- semantic recipes for:
  - `ui.text.*`
  - `ui.surfaceText.*`
  - `ui.control.*`
  - `ui.field.base`
  - `ui.surface.*`
  - `ui.status.*`
  - `ui.button.*`

Implemented in `demos/theme-rmx-01`:

- demo server on port `44100`
- app shell showing buttons, cards, popover-like panels, and content areas
- demo now composes more heavily from semantic `ui` recipes instead of bespoke styles

## Current design direction

The design goal is a clean, utilitarian web-app theme:

- compact controls
- neutral surfaces
- semantic colors
- readable but quiet typography
- appropriate for dashboards, admin tools, forms, menus, and internal product UI

The preferred styling model is:

- one shared base treatment for an object like a control or surface
- separate tone/state mixins layered on top
- visual differences should mostly come from tokenized tone, not ad hoc component-specific styling

## What feels good

- The token contract and CSS custom property strategy feel right
- The package is now more than raw tokens; it has early design-system primitives
- Buttons feel much more cohesive after moving toward shared control structure plus tone
- The demo is proving real composition, not only page-specific CSS

## What is intentionally tabled

Typography inside surfaces is not good enough yet and should be the next focus area before expanding the package too far.

Specific issues to revisit:

- `ui.surfaceText.*` has now been introduced as the first dedicated surface typography layer
- it already improves eyebrow/title/body hierarchy in the demo
- but it is still an early pass, not a complete typography system
- headings inside cards/dialogs/content areas may still need more refinement
- body copy rhythm inside surfaces still needs more tuning
- content hierarchy inside surfaces still needs more polish for real application UIs

## Immediate next focus

- improve typography recipes for surface content
  - likely add or refine roles like section title, caption, supporting text, and mono/code
  - likely separate page text roles from surface text roles
  - likely improve vertical rhythm between eyebrow, heading, body, and supporting text

## Deferred design-system work

We want to come back and turn this into a fuller design system after the surface typography pass feels strong.

- add shared interactive row/item recipes
  - useful for tabs, menus, combobox options, command items, navigation rows
- add a few layout primitives
  - stack/cluster/container style helpers could help apps and agents compose pages more reliably
- add a few more structural recipes for list/menu/select-style items
  - a shared primitive for menu rows, tab triggers, option rows, command items, sidebar rows, and similar interactive items
- introduce a slightly more semantic text scale
  - likely roles like caption, sectionTitle, and code/mono on top of body, label, title, and display
- keep `ui` centered on composable base objects plus tone/state mixins
  - examples:
    - `ui.control.base` + `ui.button.primary`
    - `ui.item.base` + `ui.item.selected`
    - `ui.surface.base` + `ui.status.warning`
- validate the abstraction with an alternate scoped theme
  - use a second theme or scoped theme variant to confirm recipes actually adapt cleanly

## Desired long-term shape

If we take this all the way to a comprehensive design system, the likely layering is:

- primitive tokens
  - size, weight, line height, tracking, family, color, spacing, radius, and control sizing
- semantic text styles
  - body, bodySm, label, caption, title, display, and code
- contextual composition recipes
  - surface text, field text, menu text, item rows, controls, surfaces, statuses, and layout primitives

The important guardrail is that we should not confuse demo-specific recipes with final design-system taxonomy.

## Commits so far

- `2742f4c9e` Add theme package foundation
- `2671b784d` Add RMX_01 theme demo
- `826511f90` Add semantic theme recipes
