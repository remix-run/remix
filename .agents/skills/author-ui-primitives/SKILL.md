---
name: author-ui-primitives
description: Build idiomatic headless primitives in `packages/ui` for Remix. Use when authoring or revising accessible UI behavior, required structural styles, public primitive events, or shared primitive utilities under `packages/ui/src`.
---

# Author UI Primitives

Use this skill when building or revising `packages/ui` primitive APIs. The public
`@remix-run/ui/*` entries are sourced from `packages/ui/src/*` and are not
available through the `remix` package.

## Source Layout

Each public primitive has a top-level `packages/ui/src/<name>.ts` or
`packages/ui/src/<name>.tsx` entry.

Common files:

- `<name>.ts` or `<name>.tsx`: the public primitive entry and implementation.
- `<name>/README.md`: usage docs for the primitive.
- `<name>.test.ts` or `<name>.test.tsx`: primitive tests.
- `demos/<name>.demo.tsx`: demo cases for the shared UI demo app.
- `lib/*`: shared implementation-only behavior used by multiple primitives.

Current examples:

- low-level behavior modules: `anchor`, `popover`, `listbox`
- composed behavior modules: `combobox`, `menu`, `select`
- self-contained controls: `accordion`, `tabs`, `toggle`

When adding or moving public entries, update both `exports` and
`publishConfig.exports` in `packages/ui/package.json`. Public entries use the
flat `./<name>` path.

## Layering

Choose the smallest layer that fits the job.

- A headless primitive owns behavior, ARIA, registration, keyboard handling,
  refs, and public events. It exports named providers and mixins.
- A shared primitive utility belongs in `src/lib` only when multiple primitives
  already need it.

Good composition flows downward:

- `select` composes `popover` and `listbox`.
- `combobox` composes `popover` and `listbox`, then owns input text, filtering,
  and popup timing.
- `menu` composes `popover`, outside interactions, typeahead, and hover aim.
- `accordion`, `tabs`, and `toggle` keep their own primitive contexts.

## Public API Shape

Primitive modules export named bindings, and callers namespace them at import
time:

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

Use `Context`, `ItemContext`, or `GroupContext` for providers, and short role
names for mixins such as `trigger`, `popover`, `list`, `option`, `hiddenInput`,
`root`, `item`, `content`, `panel`, `parent`, or `control`.

Do not add a public namespace object just to group exports. The established
pattern is named exports plus `import * as name`.

README examples should import primitives from `@remix-run/ui/...` and component
APIs from `remix/component`. Source files in this package import other primitive
APIs from `@remix-run/ui/...` and component APIs from `@remix-run/component`.

## Component Runtime

Primitive components use the current Remix component two-phase shape:

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
  should trigger a follow-up render.
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

When waiting for transitions or timers, use existing utilities such as
`waitForCssTransition(...)`, `wait(...)`, and `flashAttribute(...)`, then check
the component signal before dispatching events or updating more state.

## Public Events

Use bubbling DOM events for public primitive contracts, not for internal
coordination.

Established public event pattern:

- define a `const EVENT_NAME = 'rmx:<primitive>-<action>' as const`
- declare the event on `HTMLElementEventMap`
- export an event class with readonly payload fields
- dispatch from the meaningful host/root node
- export an `on<Primitive><Action>(handler)` mixin that wraps `on(...)`
- also support callback props such as `onValueChange` when the primitive is
  stateful

Examples include `SelectChangeEvent`, `ComboboxChangeEvent`, `MenuSelectEvent`,
`AccordionChangeEvent`, `TabsChangeEvent`, and `ToggleChangeEvent`.

## Styling

Primitives may use `css(...)` only for structural styles required for correct
positioning, visibility, scrolling, or interaction. Typography, colours,
spacing, borders, shadows, radii, decorative icons, and themes belong to the
consumer.

## Testing And Docs

For behavior changes, test the primitive directly.

Add or update:

- `<name>.test.tsx` for provider, mixin, keyboard, focus, registration, and event
  behavior
- browser tests only when DOM behavior needs a real browser
- demos under `packages/ui/src/demos`
- `<name>/README.md` examples that import from `@remix-run/ui/...`
- package change files when published behavior changes

## Checklist

Before finishing a `packages/ui` primitive change, verify:

- the public entry is `packages/ui/src/<name>.ts` or
  `packages/ui/src/<name>.tsx` and exports match `packages/ui/package.json`
- implementation-only shared helpers live under `packages/ui/src/lib`
- primitives use named exports and are consumed with namespace imports
- context is a plain getter/method object, not a controller or emitter layer
- host refs are registered and unregistered with the owning mixin/component
- controlled and uncontrolled state paths are both covered when the existing
  contract supports them
- public events use the established event class plus `on...` mixin pattern
- structural styles are limited to what behavior requires
- docs, demos, tests, and change files match the public surface touched

## Anti-Patterns

Avoid:

- adding public APIs under `src/lib`
- exporting a namespace object when named exports already fit
- re-implementing `popover`, `listbox`, typeahead, outside-click, or keyboard
  helpers inside a higher-level primitive
- duplicating selected, active, open, or input state across layers without a clear
  owner
- using DOM events or context emitters for internal re-render signaling
- placing one-off helpers in `src/lib` before a second primitive needs them
