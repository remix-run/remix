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
- `css` prop parity is not targeted; styling is mixin/`style` based in current DOM runtime
- host-prop `on={{...}}` / `connect` semantics are not first-class; event behavior uses mixins (`on(...)`)

## Remaining parity decisions

- `tween` / `easings` export parity is still a product decision (`spring` exists today)
- JSX intrinsic typing remains intentionally simpler than legacy `component`
- `ComponentHandle` is intentionally different from legacy handle APIs (for example no built-in `context` helpers)

## Historical note

If you need the original parity investigation context (before SSR/frame/hydration
landed), use the project transcript history rather than this file. This file is
now maintained as current-state guidance.
