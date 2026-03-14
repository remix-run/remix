# Design System Worklog

## Current

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
  - `ui.fieldText.*`
  - `ui.card.*`
  - `ui.sidebar.*`
  - `ui.nav.*`
  - `ui.item.*`
  - `ui.surface.*`
  - `ui.status.*`
  - `ui.button.*`

Implemented in `demos/theme-rmx-01`:

- demo server on port `44100`
- docs-style explorer shell with sticky, scrollable sidebar navigation
- multiple pages for:
  - overview
  - proof sheet
  - theme values
  - ui recipes
  - components
  - layouts
- a proof-sheet route that acts like a compact fake app for judging theme feel quickly
- demo composes heavily from semantic `ui` recipes instead of bespoke styles
- demo includes a Playwright screenshot workflow for iterative visual review
  - `pnpm -C demos/theme-rmx-01 run screenshot`
  - `pnpm -C demos/theme-rmx-01 run screenshot:card`

## Validation

Most recent validation loops have included:

- `pnpm --filter @remix-run/theme run typecheck`
- `pnpm --filter @remix-run/theme run test`
- `pnpm -C demos/theme-rmx-01 run typecheck`
- `pnpm run lint`

## Learned

- The package has crossed from a token contract into an early design-system substrate.
- The screenshot workflow is now good enough for iterative visual review without waiting on manual screenshots.
- The `System Recipes` section needs to behave like a reference artifact, not like a set of normal content cards.
- `Content Areas` benefit when intro text and list rhythm are handled as separate spacing boundaries.
- The card recipe layer is a good fit for this codebase because it captures spacing structure without forcing wrapper components.
- The explorer model is a better fit than a single long demo page because it cleanly separates theme feel, API reference, and future component docs.

## Next

- Keep refining the demo so each section clearly demonstrates a system concept without unnecessary noise.
- Continue using screenshots for any non-trivial visual pass.
- Commit the current uncommitted design-system and memory changes when ready.

## Commits So Far

- `2742f4c9e` Add theme package foundation
- `2671b784d` Add RMX_01 theme demo
- `826511f90` Add semantic theme recipes
