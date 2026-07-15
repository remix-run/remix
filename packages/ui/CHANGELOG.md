# `theme` CHANGELOG

This is the changelog for [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui). It follows [semantic versioning](https://semver.org/).

## v0.4.0

### Minor Changes

- BREAKING CHANGE: Replaced the styled button component API with a default `button()` mixin exported from `@remix-run/ui/button`.

  Use the mixin directly on button-like hosts instead of importing `Button` or composing the previous slot style exports:

  ```tsx
  import button from '@remix-run/ui/button'

  <button mix={button()}>Edit order</button>
  <button mix={button({ size: 'lg', tone: 'primary' })}>Add product</button>
  <button mix={button({ tone: 'ghost' })}>Cancel</button>
  ```

- Added a default `checkbox()` mixin exported from `@remix-run/ui/checkbox` for styling native checkbox inputs.

  Checkbox controls use the same keyboard focus shadow as `input()` controls and support an optional visual `state` for app-owned checked, unchecked, and mixed states.

  ```tsx
  import checkbox from '@remix-run/ui/checkbox'

  <input defaultChecked mix={checkbox()} name="permissions" value="read" />
  <input indeterminate mix={checkbox({ size: 'lg', state: 'mixed' })} />
  ```

- Added top-level component exports for headless primitives and styled components.

  Primitive-only modules import directly from their component path, while modules with styled wrappers expose lower-level behavior under `/primitives`:

  ```tsx
  import button from '@remix-run/ui/button'
  import * as select from '@remix-run/ui/select/primitives'
  ```

  BREAKING CHANGE: Removed the `@remix-run/ui/components/*` subpath exports. Import
  component modules from `@remix-run/ui/*` instead.

  BREAKING CHANGE: Removed root helper exports that were only intended for first-party
  component internals:
  - `flashAttribute`
  - `hiddenTypeahead`
  - `matchNextItemBySearchText`
  - `onKeyDown`
  - `SearchValue`
  - `wait`
  - `waitForCssTransition`

  Removed the `@remix-run/ui/scroll-lock` subpath export. Scroll locking is now an
  internal popover implementation detail.

- Added a default `input()` mixin exported from `@remix-run/ui/input` for standalone native inputs, plus `input.root()` and `input.field()` for icon-capable input layouts.

  ```tsx
  import input from '@remix-run/ui/input'

  <input mix={input()} placeholder="Limit" />

  <div mix={input.root()}>
    <SearchIcon />
    <input mix={input.field()} placeholder="Search and filter products" />
  </div>
  ```

- Added a default `radio()` mixin exported from `@remix-run/ui/radio` for styling native radio inputs.

  Radio controls use the same keyboard focus shadow as `input()` controls.

  ```tsx
  import radio from '@remix-run/ui/radio'

  <input defaultChecked mix={radio()} name="shipping-speed" value="standard" />
  <input mix={radio({ size: 'lg' })} name="shipping-speed" value="express" />
  ```

- Added styled component subpath exports under `@remix-run/ui/*` for accordion, breadcrumbs, checkbox, combobox, menu, and select. These are the package-owned implementations behind the `remix/ui/*` entrypoints.

- Added `tabs` and `tabs/primitives` exports for controlled and uncontrolled tab groups with toggle-slider active tabs, button-sized tab text, active-tab panels, keyboard activation, and bubbling tab change events.

  ```tsx
  import { Tabs, TabList, Tab, TabPanel } from '@remix-run/ui/tabs'
  ;<Tabs defaultActiveTab="overview">
    <TabList aria-label="Project sections">
      <Tab name="overview">Overview</Tab>
      <Tab name="activity">Activity</Tab>
    </TabList>
    <TabPanel name="overview">Project summary.</TabPanel>
    <TabPanel name="activity">Recent changes.</TabPanel>
  </Tabs>
  ```

- Added `toggle()` styles and `toggle/primitives` for boolean switch controls with medium and large sizes.

  ```tsx
  import toggle from '@remix-run/ui/toggle'
  import * as togglePrimitive from '@remix-run/ui/toggle/primitives'

  <input defaultChecked mix={toggle({ size: 'lg' })} />
  <button aria-label="Notifications" mix={[...toggle(), togglePrimitive.control({ defaultChecked: true })]} />
  ```

### Patch Changes

- Forward the frame's name as the resolve target when a named `<Frame>` is resolved on the client

  Only the reload and server resolve paths passed the frame's name; the client resolve path — a fresh client mount, or a `clientEntry`-wrapped frame remounted when a non-root ancestor reloads — called `resolveFrame` without it. Frames that branch on the target (for example via an `X-Remix-Target` header) now receive the correct content instead of the no-target response.

- Fixed hydration for multiple `clientEntry` components in the same module

- Adopt a Fragment-nested `<Frame>`'s server-rendered hydration marker at `clientEntry` boundaries

  A `<Frame>` that is the first child of a bare Fragment returned by a `clientEntry` now adopts its streamed hydration marker instead of taking the fresh-insert path, which previously re-fetched `src` on the client and duplicated the streamed subtree. A `<Frame>` wrapped in a host element already hydrated cleanly.

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Remix UI component render functions no longer receive props as an argument. Type component props on `Handle<Props>` and read current values from `handle.props` in both setup and render code.

- Updated `anchor(floating, anchorTarget, options)` to accept either an `HTMLElement` or coordinate target via the new `AnchorPoint`/`AnchorTarget` types.

- Added `menu.contextTrigger()` so menus can open from right-click pointer locations while keeping existing keyboard navigation, submenus, and selection behavior.

### Patch Changes

- Fixed `css(...)` so nested selector objects render recursively instead of serializing deeper nested rules as `[object Object]` (see #11459).

- Dispatch reload events for nested frames when an ancestor frame reloads

- Prevent non-blocking frames from displaying their fallback when an ancestor frame is reloaded

## v0.2.0

### Minor Changes

- Add a `signal` option to `renderToStream()` so request aborts can cancel pending frame rendering without invoking `onError` (see #11431).

### Patch Changes

- Add explicit public API types for UI component, mixin, scheduler, stylesheet, animation, and theme helpers so generated declarations no longer depend on broad inference across helper factories (see #11433).

- Fix rendering and JSX types for booleanish string attributes so `contentEditable={false}`, `draggable={false}`, `spellCheck={false}`, and matching SVG attributes produce explicit `"false"` values instead of being omitted. The `translate` JSX type now accepts the HTML attribute values `"yes"` and `"no"` (see #11434).

- Fix hydrated `@remix-run/ui` components so non-rendering children inside fragments keep the correct DOM anchor when they later become renderable (see #11425).

- Ignore component updates scheduled after a frame reload has already removed that component, avoiding `Node.insertBefore` errors from stale updates after the frame renders replacement markup (see #11422).

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
