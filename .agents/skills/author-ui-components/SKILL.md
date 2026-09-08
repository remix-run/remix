---
name: author-ui-components
description: Build idiomatic `packages/ui` components for Remix. Use when authoring or revising first-party UI style mixins, headless primitives, styled component wrappers, or shared component utilities under `packages/ui/src`.
---

# Author UI Components

Use this skill when building or revising `packages/ui` component APIs. In current
Remix UI, the public `remix/ui/*` and `@remix-run/ui/*`
entries are sourced from `packages/ui/src/*`.

## Source Layout

Component modules live in `packages/ui/src/<name>/`.

Common files:

- `index.ts` or `index.tsx`: the primary public component entry.
- `primitives.ts` or `primitives.tsx`: lower-level headless behavior when the
  component also has styled wrappers.
- `README.md`: usage docs for both styled components and primitives.
- `*.demo.tsx`: demo cases for the UI demo app.
- `index.test.tsx` and `primitives.test.tsx`: wrapper and primitive tests.
- `shared/*`: component-only visual tokens, icons, and reusable style mixins.

Current examples:

- style-only helpers: `button`, `input`
- low-level behavior modules: `anchor`, `popover`, `listbox`
- primitives plus styled wrappers: `accordion`, `checkbox`, `combobox`, `menu`,
  `select`
- rendered styled components without a primitive layer: `breadcrumbs`

When adding or moving public entries, update both `exports` and
`publishConfig.exports` in `packages/ui/package.json`. Prefer the
`./<name>` path for component docs and styled wrappers, with lower-level
behavior under `./<name>/primitives` when a primitive layer exists.

## Layering

Choose the smallest layer that fits the job.

- A style helper returns `css(...)` descriptors and optionally a tiny default-attr
  mixin, like `button()` or `input.root()`.
- A headless primitive owns behavior, ARIA, registration, keyboard handling,
  refs, and public events. It exports named providers and mixins.
- A styled wrapper composes primitives, shared styles, icons, and authored
  structure. It should not duplicate primitive behavior.
- A shared component utility belongs in `src/shared` only when multiple
  components already need it.

Good composition flows downward:

- `select` composes `popover` and `listbox`.
- `combobox` composes `popover` and `listbox`, then owns input text, filtering,
  and popup timing.
- `menu` composes `popover`, outside interactions, typeahead, and hover aim.
- `accordion` and `checkbox` keep their own primitive contexts and use styled
  wrappers for the ergonomic API.

## Public API Shape

Primitive modules export named bindings, and callers namespace them at import
time:

```tsx
import * as select from '@remix-run/ui/select/primitives'

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

Use `Context`, `ItemContext`, or `GroupContext` for providers, and short role
names for mixins such as `trigger`, `popover`, `list`, `option`, `hiddenInput`,
`root`, `item`, `content`, `panel`, `parent`, or `control`.

Do not add a public namespace object just to group exports. The established
pattern is named exports plus `import * as name`.

Styled wrapper modules export named components and reusable style constants:

```tsx
export const triggerStyle = selectTriggerCss

export function Select(handle: Handle<SelectProps>): () => RemixNode {
  return () => {
    let { children, defaultLabel, defaultValue, disabled, name, mix, ...buttonProps } = handle.props

    return (
      <select.Context defaultLabel={defaultLabel} defaultValue={defaultValue} disabled={disabled}>
        <button {...buttonProps} type="button" mix={[triggerStyle, select.trigger(), mix]}>
          ...
        </button>
        {name && <input mix={select.hiddenInput()} />}
      </select.Context>
    )
  }
}
```

README examples should import from `remix/ui/...`. Source files in this
package usually import public UI APIs from `@remix-run/ui` and component APIs
from `@remix-run/ui/...`.

## Component Runtime

Components use the current Remix UI two-phase shape:

```tsx
export function Component(handle: Handle<ComponentProps>): () => RemixNode {
  let hasInitialized = false
  let value: string | null = null

  return () => {
    if (!hasInitialized) {
      value = handle.props.defaultValue ?? null
      hasInitialized = true
    }

    return handle.props.children
  }
}
```

Rules:

- Read props from the stable `handle.props` object in setup and render code.
- Keep component lifetime state in setup scope and schedule renders with
  `handle.update()`.
- Initialize uncontrolled state lazily from `handle.props` during the first
  render when defaults depend on current props or registered children.
- Await `handle.update()` before DOM work that depends on the next rendered tree;
  check the returned signal before continuing async flows.
- Use `handle.queueTask()` for post-render ref callbacks, registration checks,
  popup show/hide work, CSS-transition follow-up, and public ref delivery.

## Context Providers

Providers scope one behavior instance. Prefer plain context objects with getters
and methods over controller classes.

Use context for:

- current prop-backed state through getters
- registered descendants, root nodes, trigger nodes, surfaces, and lists
- methods such as `open()`, `close()`, `navigate()`, `select()`,
  `highlight()`, `toggleItem()`, or `setInputText()`
- stable public refs backed by getters and methods

Provider patterns:

- Call `handle.context.set(...)` once in setup scope when the object can stay
  stable.
- Reset render-scoped registries in the render function when children
  re-register each render.
- Use a "next registry" plus a queued comparison when child registration changes
  should trigger a follow-up render, like checkbox groups.
- Use nested item providers when one item needs per-item context, like
  `AccordionItemProvider`.
- Return `handle.props.children` unless the provider must compose lower-level
  providers, like `SelectProvider` returning `listbox.Context`.

Do not add event emitters to context just to wake descendants. Normal component
updates, getters, and context methods are the default coordination layer.

## Mixins

Mixins adapt one host element to one behavior role.

Use `createMixin` with explicit host, argument, and prop types:

```tsx
const triggerMixin = createMixin<HTMLButtonElement, [], ElementProps>((handle) => {
  let context = handle.context.get(SelectProvider)

  return (props) => [
    attrs({
      'aria-haspopup': 'listbox',
      'aria-expanded': context.isExpanded ? 'true' : 'false',
      disabled: context.disabled ? true : props.disabled,
    }),
    ref((node: HTMLButtonElement, signal) => {
      context.registerTrigger(node)
      signal.addEventListener('abort', () => {
        context.unregisterTrigger(node)
      })
    }),
    on('click', () => {
      context.open()
    }),
  ]
})
```

Mixin rules:

- Own one role and one host element.
- Derive ARIA, `data-*`, `hidden`, `disabled`, `tabIndex`, and ids from context
  getters.
- Normalize DOM input locally, then call context methods.
- Keep role-specific keyboard parsing in the role mixin.
- Register host nodes with `ref(...)`, `handle.queueTask(...)`, or an insert
  listener, and clean up registrations with the abort signal when needed.
- For mixins that support both native inputs and custom elements, use `hostType`,
  `createElement(...)`, or `renderMixinElement(...)` to rewrite props safely.
- Put user `mix` last in styled wrapper arrays so callers can extend the
  composed component.

If a mixin accepts optional options and also receives host props, follow the
existing `options = {}, props = options as ElementProps` pattern when needed to
distinguish authored options from host props.

## DOM And Async Work

Keep imperative DOM work near the owner of the relevant ref.

- `popover.surface()` owns `showPopover()`, `hidePopover()`, outside click,
  focus restoration, anchoring, and scroll locking.
- `select.popover()` and `combobox.popover()` own popup min-width syncing because
  they know their trigger/input refs.
- `listbox` owns option scrolling and selection flash.
- `menu` owns branch closing, focus transfer, hover aim, and close animation
  sequencing.
- Checkbox primitives own native input synchronization, including
  `indeterminate`.

When waiting for transitions or timers, use existing utilities such as
`waitForCssTransition(...)`, `wait(...)`, and `flashAttribute(...)`, then check
the component signal before dispatching events or updating more state.

## Public Events

Use bubbling DOM events for public component contracts, not for internal
coordination.

Established public event pattern:

- define a `const EVENT_NAME = 'rmx:<component>-<action>' as const`
- declare the event on `HTMLElementEventMap`
- export an event class with readonly payload fields
- dispatch from the meaningful host/root node
- export an `on<Component><Action>(handler)` mixin that wraps `on(...)`
- also support callback props such as `onValueChange` when the component is
  stateful

Examples include `SelectChangeEvent`, `ComboboxChangeEvent`, `MenuSelectEvent`,
`AccordionChangeEvent`, `CheckboxChangeEvent`, and `CheckboxGroupChangeEvent`.

## Styling

Use `css(...)` descriptors and shared component tokens.

- Prefer `componentStyleValues` for cross-component spacing, radii, surfaces,
  text colors, focus rings, and control heights.
- Reuse `shared/listbox-popover-styles.ts` for listbox-like popover surfaces,
  lists, options, labels, and indicators.
- Export style constants such as `triggerStyle`, `listStyle`, `itemStyle`, or
  `popoverStyle` when custom composition is documented.
- Keep shared CSS helpers in `src/shared` only when multiple
  components consume them.
- For simple style helpers, return readonly arrays of CSS and behavior mixins
  with precise public option types.

## Testing And Docs

For behavior changes, test the primitive layer directly. For styled wrappers,
test that the wrapper composes the expected primitive roles, attributes, hidden
inputs, and public events.

Add or update:

- `primitives.test.tsx` for provider, mixin, keyboard, focus, registration, and
  event behavior
- `index.test.tsx` for styled wrapper markup and composition
- browser tests only when DOM behavior needs a real browser
- demos for visible components; for new built-in component modules, add the
  module name to `componentDemoModules` in
  `packages/ui/demo/app/demo-runner/view.tsx` so `src/<name>/*.demo.tsx` files
  appear under the "Built-in components" heading instead of "General demos"
- `README.md` examples that import from `remix/ui/...`
- package change files when published behavior changes

## Checklist

Before finishing a `packages/ui` component change, verify:

- source lives under `packages/ui/src/<name>` and exports match
  `packages/ui/package.json`
- the API layer is correct: style helper, primitive module, styled wrapper, or
  shared utility
- primitives use named exports and are consumed with namespace imports
- styled wrappers compose primitives instead of copying their behavior
- context is a plain getter/method object, not a controller or emitter layer
- host refs are registered and unregistered with the owning mixin/component
- controlled and uncontrolled state paths are both covered
- public events use the established event class plus `on...` mixin pattern
- built-in component demos are listed in the demo app's
  `componentDemoModules` allowlist
- docs, demos, tests, and change files match the public surface touched

## Anti-Patterns

Avoid:

- adding new modules under `src/lib` for component public APIs
- exporting a namespace object when named exports already fit
- re-implementing `popover`, `listbox`, typeahead, outside-click, or keyboard
  helpers inside a higher-level control
- duplicating selected, active, open, or input state across layers without a clear
  owner
- using DOM events or context emitters for internal re-render signaling
- wrapping every primitive in styled markup when the lower-level primitive is the
  actual product
- placing one-off visual constants in `shared` before a second component needs
  them
