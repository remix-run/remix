---
name: author-ui-components
description: Build idiomatic headless primitives in packages/ui for Remix. Use when authoring or revising first-party accessible UI behavior, required structural styles, public primitive events, or shared primitive utilities.
---

# Author UI Primitives

Use this skill when building or revising the independently versioned `@remix-run/ui` package. The package contains headless, accessible primitives only. It is not available through the `remix` package, so consumers install it separately and import its public subpaths directly.

## Public Boundary

Each primitive has a flat public subpath:

- `@remix-run/ui/accordion`
- `@remix-run/ui/anchor`
- `@remix-run/ui/combobox`
- `@remix-run/ui/listbox`
- `@remix-run/ui/menu`
- `@remix-run/ui/popover`
- `@remix-run/ui/select`
- `@remix-run/ui/tabs`
- `@remix-run/ui/toggle`

Do not add styled component wrappers, visual design tokens, style-only controls, or nested `/primitives` entrypoints. A public export must map to a dedicated top-level `src/<name>.ts` or `src/<name>.tsx` file. A primitive may be implemented directly in its public entry. Use `src/lib` only for shared or implementation-only helpers, and do not add barrel exports or thin pass-through wrappers there.

Primitive modules export named bindings, and callers namespace them at import time:

```tsx
import * as select from '@remix-run/ui/select'

function StatusSelect() {
  return () => (
    <select.Context defaultLabel="Status">
      <button type="button" mix={select.trigger()} />
      <div mix={select.popover()}>
        <div mix={select.list()}>
          <div mix={select.option({ label: 'Open', value: 'open' })}>Open</div>
        </div>
      </div>
    </select.Context>
  )
}
```

Use `Context`, `ItemContext`, or `GroupContext` for providers, and short role names for mixins such as `trigger`, `popover`, `list`, `option`, `hiddenInput`, `root`, `item`, `content`, `panel`, `parent`, or `control`. Do not add a namespace object just to group exports.

## Package Boundaries

Primitives are authored with the same public component APIs available to application code. Import runtime, mixin, styling, and JSX types from `@remix-run/component`; it is a normal dependency of `@remix-run/ui`. Do not reach into private component-runtime modules.

When adding or moving public entries, update both `exports` and `publishConfig.exports` in `packages/ui/package.json`. Keep `@remix-run/ui` versioned independently at `0.x`, and do not add it to `packages/remix/manifest.json`.

## Primitive Responsibilities

A headless primitive may own:

- accessible roles, ARIA relationships, ids, and state attributes
- keyboard, pointer, focus, typeahead, and outside-interaction behavior
- controlled and uncontrolled state already present in that primitive's contract
- registration of related elements and scoped context
- public DOM events and callback props
- hidden native inputs required for form behavior
- only the structural CSS required for correct positioning, visibility, scrolling, or interaction

It must not own typography, colour, spacing, borders, shadows, radii, decorative icons, themes, or product-specific markup. Preserve existing API contracts unless a requested change explicitly includes redesigning them.

Higher-level primitives may compose lower-level primitives. For example, select and combobox can compose listbox and popover behavior instead of duplicating it.

## Context Providers

Prefer stable context objects with getters and methods over controller classes or internal event emitters.

- Call `handle.context.set(...)` once in setup scope when the object can stay stable.
- Read changing props through `handle.props`.
- Reset render-scoped registries when children re-register each render.
- Use nested providers where an item needs its own context.
- Return `handle.props.children` unless the provider must compose lower-level providers.
- Use component updates, getters, and context methods for internal coordination.

## Mixins

Use `createMixin` with explicit host, argument, and prop types. A mixin should own one semantic role on one host element.

- Derive ARIA, `data-*`, `hidden`, `disabled`, `tabIndex`, and ids from context getters.
- Normalize DOM input locally, then call context methods.
- Keep role-specific keyboard parsing in the role mixin.
- Register nodes with `ref(...)`, `handle.queueTask(...)`, or an insert listener.
- Clean registrations up with the abort signal.
- Use `hostType`, `createElement(...)`, or `renderMixinElement(...)` when a primitive supports multiple host element types.
- Await `handle.update()` before DOM work that depends on the next tree, and check the returned signal before continuing async work.

Keep imperative DOM behavior close to the mixin that owns the relevant ref. Reuse shared behavior utilities only when multiple primitives genuinely need them.

## Public Events

Use bubbling DOM events for public contracts, not internal coordination. Follow the established pattern:

- define a `const EVENT_NAME = 'rmx:<primitive>-<action>' as const`
- declare it on `HTMLElementEventMap`
- export an event class with readonly payload fields
- dispatch from the meaningful host or root
- export an `on<Action>(handler)` mixin that wraps `on(...)`
- retain callback props when they are part of the existing stateful API

## Styling

Structural styles are allowed only when behavior would otherwise be incorrect or unusable. Keep them local and minimal. A primitive should still look like ordinary browser markup until the consumer supplies visual styles.

Before adding CSS, ask whether it is required for positioning, visibility, scrolling, focus mechanics, or another functional invariant. If it merely makes the result look designed, it does not belong in this package.

## Tests And Docs

For behavior changes, update the primitive's colocated tests and README. Cover keyboard and focus behavior, ARIA state, registration and cleanup, controlled and uncontrolled paths where supported, public events, and structural styling invariants.

README examples should import the primitive from `@remix-run/ui/<name>` and component APIs from `remix/component`. Add a package change file for published behavior changes.

## Checklist

Before finishing:

- the public entry is a flat `@remix-run/ui/<name>` subpath backed by `src/<name>.ts`
- implementation lives in the public entry or in focused `src/lib` helpers without internal barrel wrappers
- the primitive uses only public `@remix-run/component` APIs
- accessibility and behavior are owned by the correct role mixins
- visual design opinions have not entered the package
- existing controlled and uncontrolled contracts remain intact
- refs and async work clean up correctly
- public events follow established conventions
- docs, tests, package metadata, and change files match the public surface
