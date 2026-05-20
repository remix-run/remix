# `theme` CHANGELOG

This is the changelog for [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui). It follows [semantic versioning](https://semver.org/).

## v0.1.2

### Patch Changes

- Fix a bug in Safari where cross-origin links to a new subdomain incorrectly set `event.canIntercept=true` and try to opt-into a `<Frame>` navigation which fails. Cross-origin links now correctly fall through to a document navigation in Safari.

- Keep streamed frame content in its template when a resolved frame stream starts with a doctype-only chunk.

- Emit the built-in theme reset in `rmx-reset` so generated Remix UI component styles can override it. Document where app layers should sit relative to Remix UI layers.

- Fixed layout animation interruptions so they restart from their current position and don't restart for updates that don't change their final position.

- Improved type inference for `on` mixin

  When defining a wrapper for `on`, use `target` generic on your handler type:

  ```ts
  import { on, type Dispatched } from '@remix-run/ui'

  const ACCORDION_CHANGE_EVENT = 'rmx:accordion-change' as const

  type AccordionChangeEvent = Event & {
    accordionType: 'single' | 'multiple'
    itemValue: string
    value: string | null | string[]
  }

  declare global {
    interface HTMLElementEventMap {
      [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent
    }
  }

  type AccordionChangeHandler<target extends HTMLElement> = (
    event: Dispatched<AccordionChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>

  export function onAccordionChange<target extends HTMLElement>(
    handler: AccordionChangeHandler<target>,
    captureBoolean?: boolean,
  ) {
    return on(ACCORDION_CHANGE_EVENT, handler, captureBoolean)
  }

  let button = (
    <button
      mix={[
        onAccordionChange((event, signal) => {
          event
          // ^? Dispatched<AccordionChangeEvent, HTMLButtonElement>
          event.currentTarget
          //    ^? HTMLButtonElement
        }),
      ]}
    />
  )
  ```

- Preserve hydrated client entry instances and nested frame resolution during full-document root frame reloads.

- Document the `run()` `loadModule` and `resolveFrame` hooks so editor hints explain how to hydrate client entries and resolve browser-loaded frames.

- Optimize UI runtime hot paths.

  - Fast path for plain `on()` mixins that patches host listeners in place.
  - Lazy direct listener closures for event listeners managed by the runtime.
  - Lazy mixin scope signals to avoid unnecessary AbortController work.
  - Faster keyed reconciliation for in-order, append-only, single-removal, and pair-swap lists.
  - Property-level patching for object styles during updates.
  - Bulk clearing for removable child lists, with an innerHTML guard.

- Fix a flash of unstyled content when navigating between two pages whose hydrated client entries use different `css()` rules. Style adoption now releases prior-page server styles by refcount instead of resetting the adopted stylesheet, so DOM preserved across a reload (e.g. inside a still-hydrated client-entry boundary) keeps its rules until the new module finishes loading and replaces it.

- Fix server rendering for `<textarea value>`, `<textarea defaultValue>`, `<input defaultValue>`, and `<input defaultChecked>` so initial form control content matches client rendering, and disallow textarea children in JSX types.

## v0.1.1

### Patch Changes

- Improved runtime rendering performance by reducing child normalization, keyed reconciliation, mixin lifecycle, scheduler phase, and host insertion overhead.

- Stripped `<!DOCTYPE>` markup from server and client frame responses before rendering frame content.

## v0.1.0

### Minor Changes

- BREAKING CHANGE: Consolidated the deprecated `@remix-run/component` package into `@remix-run/ui`. Import component runtime APIs from `@remix-run/ui`, server rendering APIs from `@remix-run/ui/server`, JSX runtime APIs from `@remix-run/ui/jsx-runtime` and `@remix-run/ui/jsx-dev-runtime`, and animation APIs from `@remix-run/ui/animation`.

  Removed the deprecated `@remix-run/ui/on-outside-pointer-down` export. Use the popover, menu, or other component-level outside interaction APIs instead.

- BREAKING CHANGE: Components now receive props through a stable `handle.props` object using `Handle<Props, Context>` instead of receiving a separate `setup` argument and render callback props. Move initialization values that previously used `<Component setup={...} />` onto regular props, and read all props from `handle.props` in both the component function and render callback.

  Before:

  ```tsx
  function Counter(handle: Handle<CounterContext>, setup: { initialCount: number }) {
    let count = setup.initialCount

    return (props: { label: string }) => (
      <button>
        {props.label}: {count}
      </button>
    )
  }

  ;<Counter setup={{ initialCount: 10 }} label="Count" />
  ```

  After:

  ```tsx
  function Counter(handle: Handle<{ initialCount: number; label: string }, CounterContext>) {
    let count = handle.props.initialCount

    return () => (
      <button>
        {handle.props.label}: {count}
      </button>
    )
  }

  ;<Counter initialCount={10} label="Count" />
  ```

  The `handle.props` object keeps the same identity for the component lifetime while its values are updated before each render, so destructuring `let { props, update } = handle` remains safe. The `setup` prop is no longer special and is treated like any other prop.

  This also removes the old pattern where setup-scope helpers had to read from a mutable variable that was reassigned inside the render callback:

  ```tsx
  function Listbox(handle: Handle<ListboxContext>) {
    let props: ListboxProps

    function select(value: string) {
      props.onSelect(value)
    }

    handle.context.set({ select })

    return (nextProps: ListboxProps) => {
      props = nextProps
      return props.children
    }
  }
  ```

  Helpers can now read the current props directly from the stable handle:

  ```tsx
  function Listbox(handle: Handle<ListboxProps, ListboxContext>) {
    function select(value: string) {
      handle.props.onSelect(value)
    }

    handle.context.set({ select })

    return () => handle.props.children
  }
  ```

- BREAKING CHANGE: Removed the deprecated `keysEvents`, `pressEvents`, and `PressEvent` exports from `@remix-run/ui`. Use `on(...)` with native DOM keyboard, pointer, and click events directly instead.

## Unreleased
