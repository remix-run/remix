# Component vs Reconciler+DOM parity notes

This document captures a point-in-time parity review of legacy
`@remix-run/component` against the newer `@remix-run/reconciler` +
`@remix-run/dom` stack.

Scope notes:

- Explicitly excludes SSR and `Frame` parity (requested exclusion)
- Focuses on runtime/API feature parity and developer-facing behavior
- Compares `packages/component/src/*` (non-`plugin-spike`) with `packages/reconciler` and `packages/dom`

## Confirmed gaps (excluding SSR and Frame)

### 1) No hydration/client-entry runtime equivalent in new stack

Legacy `component` exports `clientEntry` and `run` for client-entry hydration flow.
Current `dom`/`reconciler` exports do not provide an equivalent runtime surface yet.

### 2) Component handle surface is reduced

Legacy `Handle` includes:

- `id`
- `context` (`set/get`)
- `signal`
- `on(target, listeners)`
- `update` / `queueTask`

New `ComponentHandle` from `reconciler` currently exposes:

- `update`
- `queueTask`

Implication: app-level patterns relying on built-in context, stable IDs, handle signal lifecycle, and global event wiring helper are not 1:1 portable yet.

### 3) `on` / `connect` host-prop semantics are not in the default DOM plugin pipeline

`@remix-run/dom` JSX types include `on` and `connect` props, but `createDomPlugins(document)` currently composes:

- `createDocumentStatePlugin(document)`
- `mixPlugin`
- `stylePropsPlugin`
- `basicPropsPlugin`

There is no dedicated plugin in this default pipeline implementing legacy-style `on={{...}}` event object semantics or `connect(node, signal)` callbacks on host props. Event behavior is currently mixin-driven (`on(...)` mixin), and `connect` appears typed but not wired in default plugin semantics.

### 4) Utility export parity gap: `tween`/`easings`

Legacy `component` exports `spring`, `tween`, and `easings`.
Current `dom` exports `spring` but not `tween`/`easings`.

### 5) Type-level JSX surface is narrower

Legacy `component` ships very detailed intrinsic element typing (rich per-tag HTML/SVG/MathML and accessibility constraints).
Current `dom` typing is intentionally simpler/generic by comparison.

Implication: runtime capability may still work for many props, but type ergonomics and compile-time guidance are less feature-rich than old `component` typings.

## Areas that look covered

- Core reconciler lifecycle model (`setup -> render`)
- Explicit updates (`update`) and post-commit task queue (`queueTask`)
- DOM document-state snapshot/restore behavior via plugin
- CSS/presence/layout animation capabilities (now mixin/plugin oriented)

## Classification guide

- **Hard missing capability:** no equivalent runtime feature available in new stack
- **Migration/API gap:** capability exists but through different API/extension shape

For the current list:

- Hydration/client-entry runtime: hard missing capability
- Handle `id/context/signal/on`: hard missing capability (unless reintroduced elsewhere)
- Host-prop `on`/`connect` semantics: migration/API gap plus partial runtime gap
- `tween`/`easings`: hard missing capability (public API parity)
- Narrower JSX typings: migration/API/type-system gap

## Follow-up checklist

- [ ] Decide target parity for handle APIs (`id`, `context`, `signal`, global `on`)
- [ ] Decide whether host-prop `on` and `connect` should be first-class in `createDomPlugins`
- [ ] Decide whether to add `tween`/`easings` exports in `dom`
- [ ] Decide whether to restore richer JSX typings in `dom` or document the intentional simplification
- [ ] Add parity tests for whichever gaps are accepted as requirements
