# Design System Decisions

## Stable

- Build a theming package for Remix that works for both app-level code and future first-party Remix UI components.
- `theme` is a typed contract of CSS custom properties.
- `createTheme(values)` renders a `<style>` tag defining those variables.
- Both app code and first-party components consume `theme.*` variable references.
- `ui` provides composable `css()` recipes built on top of the token contract.

## Current

- The preferred styling model is:
  - one shared base treatment for an object like a control or surface
  - separate tone/state mixins layered on top
  - visual differences should mostly come from tokenized tone, not ad hoc component-specific styling
- Surface text is distinct from page text.
  - `ui.text.*` covers broader/common text roles
  - `ui.surfaceText.*` covers tighter, calmer text inside cards, dialogs, and similar surfaces
- Field text is distinct from generic text.
  - `ui.fieldText.*` covers shared label/help roles
- Item/list rows should be represented as a reusable primitive.
  - `ui.item.*` exists for menus, tabs, option rows, command items, and similar UI
- Card structure should start as semantic recipes, not wrapper-heavy components.
  - `ui.card.*` owns shared card layout, slot rhythm, and optional action/footer structure
  - surface tone can be selected with `ui.card.base`, `ui.card.secondary`, `ui.card.elevated`, and `ui.card.inset`
  - avoid rushing into `CardHeader`, `CardContent`, `CardFooter`, or `asChild`-style APIs unless the recipe model proves insufficient
- The demo should now be treated as a design-system explorer, not just a theme landing page.
  - `RMX_01` is the current default theme inside that explorer
  - a dedicated proof-sheet page should carry the “what does this theme feel like?” responsibility
- Reusable sidebar/navigation primitives belong in the package, but a docs-shell wrapper does not.
  - app-level ingredients like `ui.sidebar.*` and `ui.nav.*` are good system abstractions
  - the explorer shell composition itself should stay local to the demo/docs app

## Learned

- Theming is not enough on its own; a useful system needs semantic recipes, not just tokens.
- Typography and spacing rules should live at the system layer wherever possible instead of being re-solved per demo card.
- The demo should prove real composition rather than just show a pretty page.

## Avoid

- Treating demo-specific card compositions as final design-system taxonomy.
- Splitting the same component model across unrelated base styles in app code and theme utilities.
