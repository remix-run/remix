# Component vs Reconciler+DOM parity notes

This file started as the initial parity-gap tracker between legacy
`@remix-run/component` and the new `@remix-run/reconciler` + `@remix-run/dom`
stack. It is now kept as a compact status snapshot.

## Current status

The major gaps that were originally called out here are now addressed:

- SSR streaming (`renderToHTMLStream`) is implemented
- `<frame>` streaming boundaries + runtime reload support are implemented
- `clientEntry` SSR markers + client runtime hydration (`boot`) are implemented
- nested/blocking/non-blocking frame streaming behavior has parity-focused tests
- frame reload now diffs existing DOM and preserves hydrated component state

## Intentional differences from legacy `component`

These are currently intentional (not regressions):

- frame markers remain `<!-- f:{id} --> ... <!-- /f -->` (not legacy marker format)
- CSS handling is mixin-owned end-to-end:
  - server CSS output is contributed via generic streaming root-store head contributions
  - client CSS adoption hooks into generic runtime pre/post apply events
  - DOM policy/runtime internals remain CSS-agnostic

## Remaining parity decisions

- `css` prop parity is not targeted; styling is mixin/`style` based in current DOM runtime
- host-prop `on={{...}}` / `connect` semantics are not first-class; event behavior uses mixins (`on(...)`)
- `tween` / `easings` export parity is still a product decision (`spring` exists today)
- `ComponentHandle.context`

## Historical note

If you need the original parity investigation context (before SSR/frame/hydration
landed), use the project transcript history rather than this file. This file is
now maintained as current-state guidance.
