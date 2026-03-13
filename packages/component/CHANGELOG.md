# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

## v0.6.0

### Minor Changes

- BREAKING CHANGE: remove legacy host-element `on` prop support in `@remix-run/component`.

  Use the `on()` mixin instead:

  - Old: `<button on={{ click() {} }} />`
  - New: `<button mix={[on('click', () => {})]} />`

  This change removes built-in host `on` handling from runtime, typing, and host-prop composition. Component-level `handle.on(...)` remains supported.

- BREAKING CHANGE: remove legacy host-element `css` prop runtime support in `@remix-run/component`.

  Use the `css(...)` mixin instead:

  - Old: `<div css={{ color: 'red' }} />`
  - New: `<div mix={[css({ color: 'red' })]} />`

  This aligns styling behavior with the new mixin composition model.

- BREAKING CHANGE: remove legacy host-element `animate` prop runtime support in `@remix-run/component`.

  Use animation mixins instead:

  - Old: `<div animate={{ enter: true, exit: true, layout: true }} />`
  - New: `<div mix={[animateEntrance(), animateExit(), animateLayout()]} />`

  This aligns animation behavior with the new mixin composition model.

- BREAKING CHANGE: remove legacy host-element `connect` prop support in `@remix-run/component`.

  Use the `ref(...)` mixin instead:

  - Old: `<div connect={(node, signal) => {}} />`
  - New: `<div mix={[ref((node, signal) => {})]} />`

  This aligns element reference and teardown behavior with the mixin composition model.

- BREAKING CHANGE: the `@remix-run/interaction` package has been removed.

  `handle.on(...)` APIs were also removed from component and mixin handles.

  Before/after migration:

  **Interaction package APIs:**

  - Before: `defineInteraction(...)`, `createContainer(...)`, `on(target, listeners)` from `@remix-run/interaction`.
  - After: use component APIs (`createMixin(...)`, `on(...)`, `addEventListeners(...)`) from `@remix-run/component`.

  ```ts
  // Before
  import { on } from '@remix-run/interaction'

  let dispose = on(window, {
    resize() {
      console.log('resized')
    },
  })

  // After
  import { addEventListeners } from '@remix-run/component'

  let controller = new AbortController()
  addEventListeners(window, controller.signal, {
    resize() {
      console.log('resized')
    },
  })
  ```

  **Component handle API:**

  - Before: `handle.on(target, listeners)`.
  - After: `addEventListeners(target, handle.signal, listeners)`.

  ```tsx
  // Before
  function KeyboardTracker(handle: Handle) {
    handle.on(document, {
      keydown(event) {
        console.log(event.key)
      },
    })
    return () => null
  }

  // After
  import { addEventListeners } from '@remix-run/component'

  function KeyboardTracker(handle: Handle) {
    addEventListeners(document, handle.signal, {
      keydown(event) {
        console.log(event.key)
      },
    })
    return () => null
  }
  ```

  **Custom interaction patterns:**

  - Before: `defineInteraction(...)` + interaction setup function.
  - After: event mixins (`createMixin(...)`) that compose `on(...)` listeners and dispatch typed custom events.

  ```tsx
  // Before
  import { defineInteraction, type Interaction } from '@remix-run/interaction'

  export let tempo = defineInteraction('my:tempo', Tempo)

  function Tempo(handle: Interaction) {
    handle.on(handle.target, {
      click() {
        handle.target.dispatchEvent(new TempoEvent(bmp))
      },
    })
  }

  // App consumption (before, JSX)
  function TempoButtonBefore() {
    return () => (
      <button
        on={{
          [tempo](event) {
            console.log(event.bpm)
          },
        }}
      />
    )
  }

  // After
  import { createMixin, on } from '@remix-run/component'

  export let tempo = 'my:tempo' as const

  export let tempoEvents = createMixin<HTMLElement>((handle) => {
    return () => (
      <handle.element
        mix={[
          on('click', (event) => {
            event.currentTarget.dispatchEvent(new TempoEvent(bpm))
          }),
        ]}
      />
    )
  })

  // App consumption (after)
  function TempoButton() {
    return () => (
      <button
        mix={[
          tempoEvents(),
          on(tempo, (event) => {
            console.log(event.detail.bpm)
          }),
        ]}
      />
    )
  }
  ```

  **TypedEventTarget**

  `TypedEventTarget` is now exported from `@remix-run/component`.

- BREAKING CHANGE: `renderToStream()`, hydration, client updates, and frame reloads no longer hoist bare `title`, `meta`, `link`, `style`, or `script[type="application/ld+json"]` elements into `document.head`. Render head content inside an explicit `<head>` instead, or pass values like `title` to a layout component that renders the head.

  This removes ordering-sensitive head manipulation from server rendering and client reconciliation. We originally explored this behavior in the spirit of React's head "float" work, but Remix Component's async model is centered on routes and frames rather than async components, so layouts can render head content explicitly without needing to discover and reorder tags from deep in the tree.

- Add the new host `mix` prop and mixin authoring APIs in `@remix-run/component`.

  New exports include:

  - `createMixin`
  - `MixinDescriptor`, `MixinHandle`, `MixinType`, `MixValue`
  - `on(...)`
  - `ref(...)`
  - `css(...)`

  This enables reusable host behaviors and composable element capabilities without bespoke host props.

- Add new interaction mixins for normalized user input events:

  - `pressEvents(...)` for pointer/keyboard "press" interactions
  - `keysEvents(...)` for keyboard key state events

  These helpers provide a consistent mixin-based interaction model for input handling.

- Add mixin-first animation APIs for host elements:

  - `animateEntrance(...)`
  - `animateExit(...)`
  - `animateLayout(...)`

  These APIs move entrance/exit/layout animation behavior to composable mixins that can be combined with other host behaviors.

- Allow the `mix` prop to accept either a single mixin descriptor or an array of mixin descriptors.

  This lets one-off mixins use `mix={...}` while preserving array support for composed mixins, and component render props now normalize `mix` to an array or `undefined` so wrapper components can compose `mix` values without special casing single descriptors.

- Allow client `resolveFrame(...)` callbacks to return `RemixNode` content in addition to HTML strings and streams.

  This lets apps render local frame fallback and recovery UI directly from the client runtime without manually serializing HTML, and frame updates now clear previously rendered HTML before mounting the new node-based content.

- Automatically intercept anchor and area navigations through the Navigation API, with `rmx-target` to target mounted frames, `rmx-src` to override the fetched frame source, and `rmx-document` to opt back into full-document navigation.

- Add imperative frame-navigation runtime APIs and a `link(href, { src, target, history })` mixin for declarative client navigations.

  `run()` now initializes from `run({ loadModule, resolveFrame })`, the package exports `navigate(href, { src, target, history })` and `link(href, { src, target, history })`, and components can target mounted frames via `handle.frames.top` and `handle.frames.get(name)`. The `link()` mixin adds `href`/`rmx-*` attributes to anchors and gives buttons and other elements accessible link semantics with click and keyboard navigation behavior.

- Allow `resolveFrame(src, signal, target)` to receive the named frame target for targeted reloads.

  This makes it easier to distinguish targeted frame navigations when forwarding frame requests through app-specific fetch logic.

- Add SSR frame source context for nested frame rendering.

  `renderToStream()` now accepts `frameSrc` and `topFrameSrc`, `resolveFrame()` receives a `ResolveFrameContext`, and server-rendered components can read stable `handle.frame.src` and `handle.frames.top.src` values across nested frame renders.

### Patch Changes

- Preserve browser-managed live state when frame DOM diffing updates interactive elements.

  This keeps reloads from clobbering current UI state for reflected and form-like cases such as `details[open]`, `dialog[open]`, `input.checked`, editable input values, `textarea` values, `<select>` selection, and open popovers when the incoming HTML only changes serialized defaults.

- Forward hydrated client entry, frame reload, and `ready()` initialization errors to the top-level runtime target returned by `run()`, and type that runtime as a `TypedEventTarget` with an `error` event whose `.error` value is `unknown`.

  This lets `app.addEventListener('error', ...)` observe bubbling DOM errors captured by hydrated client entry roots, frame reload failures such as rejected `resolveFrame()` calls, and initialization failures that reject `app.ready()`, while also giving TypeScript-aware consumers the concrete event names and safer payload types exposed by `run()` and root listeners.

- Run mixin `insert`, `remove`, and `reclaimed` lifecycle events in the scheduler's commit phase instead of dispatching them inline during DOM diffing.

  This lets `ref(...)` and other insert-driven mixins safely call `handle.update()` during initial mount, and it makes mixin lifecycle timing line up with commit-phase DOM state before normal queued tasks run.

- Fix SVG `className` prop normalization to render as `class` in both client DOM updates and SSR stream output.

  Also add SVG regression coverage to prevent accidental `class-name` output.

- Resolve nested SVG click targets back to their enclosing anchor or area element so frame navigation still intercepts normal link clicks inside inline SVG content.

- Skip frame-navigation interception for native anchor and area elements with a `download` attribute so browsers can handle file downloads normally without needing `rmx-document`.

## v0.5.0

### Minor Changes

- BREAKING CHANGE: `handle.update()` now returns `Promise<AbortSignal>` instead of accepting an optional task callback.

  - The promise is resolved when the update is complete (DOM is updated, tasks have run)
  - The signal is aborted when the component updates again or is removed.

  ```tsx
  let signal = await handle.update()
  // dom is updated
  // focus/scroll elements
  // do fetches, etc.
  ```

  Note that `await handle.update()` resumes on a microtask after the flush completes, so the browser may paint before your code runs. For work that must happen synchronously during the flush (e.g. measuring elements and triggering another update without flicker), continue to use `handle.queueTask()` instead.

  ```tsx
  handle.update()
  handle.queueTask(() => {
    let rect = widthReferenceNode.getBoundingClientRect()
    if (rect.width !== width) {
      width = rect.width
      handle.update()
    }
  })
  ```

- BREAKING CHANGE: rename virtual root teardown from `remove()` to `dispose()`.

  Old -> new:

  - `root.remove()` -> `root.dispose()` (for both `createRoot()` and `createRangeRoot()` roots)
  - `app.remove()` -> `app.dispose()` when using `run(...)`

  This aligns virtual root teardown with `run(...).dispose()` for full-app cleanup.

- Add SSR with out-of-order streaming, selective hydration, async frames, and granular ui refresh

  ADDITIONS:

  - `<Frame>`
  - `renderToStream(node, { resolveFrame })`
  - `clientEntry`
  - `run({ loadModule, resolveFrame })`
  - `handle.frame`
  - `handle.frames`

### Patch Changes

- Fix host prop removal to fully remove reflected attributes while still resetting runtime form control state.

  Adds regression coverage for attribute removal/update behavior to prevent empty-attribute regressions.

- Fix updates for nested component-to-element replacements

- Harden SVG attribute normalization so canonical SVG attribute names are preserved consistently across server rendering, hydration, and client DOM updates.

  This fixes rendering/behavior regressions caused by incorrect attribute casing (including filter and other SVG effect/geometry attributes) and improves parity with standard React/browser SVG behavior.

## v0.4.0

### Minor Changes

- Add animation prop, spring, and tween utilities

  - `animate` prop on host elements enables enter, exit, and layout (FLIP) animations
  - `spring()` function creates spring-based animation iterators with configurable stiffness, damping, and mass
  - `tween()` function creates time-based animation iterators with customizable duration and easing (including `easings` presets)

- `VirtualRoot` now extends `EventTarget` and dispatches `error` events when errors occur during rendering or in event handlers. Listen for errors via `root.addEventListener('error', (e) => { ... })`.

### Patch Changes

- Change css processing to use data attribute instead of className

- Add `aspect-ratio` to numeric CSS properties (no longer appends `px` to numeric values)

- Bumped `@remix-run/*` dependencies:
  - [`@remix-run/interaction@0.5.0`](https://github.com/remix-run/remix/releases/tag/interaction@0.5.0)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Updated Component API

  - Removed stateless components favoring a single component shape
  - Components no longer called with `this` function context
  - Introduced `setup` prop
    - `setup` prop is passed to the setup function
    - `props` are only passed to the render function

  #### Example:

  **Before**

  ```tsx
  function Counter(
    // `this` binding
    this: Handle,
    // props available in setup scope
    { initialCount }: { initialCount: number },
  ) {
    let count = initialCount

    return ({ label }: { label: string }) => (
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        {label} {count}
      </button>
    )
  }

  let el = <Counter initialCount={10} label="Count" />
  ```

  **After**

  ```tsx
  function Counter(
    // handle is a normal parameter
    handle: Handle,
    // only `setup` prop available in setup scope
    setup: number,
  ) {
    let count = setup

    // props only available in render scope
    return (props: { label: string }) => (
      <button
        on={{
          click() {
            count++
            handle.update()
          },
        }}
      >
        {props.label} {count}
      </button>
    )
  }

  // usage
  let el = <Counter setup={10} label="Count" />
  ```

  #### Discussion:

  ##### Removing stateless components

  There was conceptual overhead of "stateful vs. stateless components" that is completely gone. All components must return a render function whether state is managed or not.

  By having only one component shape, you no longer have to think about when to return a function and when not to. It also smooths over refactors and the cognitive overhead of swapping between the two forms as the requirements change.

  Additionally, the subtle difference between the two forms was hard to spot in practice.

  ```tsx
  // this has a bug
  function Counter(this: Handle) {
    let count = 0
    return (
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        This has a bug.
      </button>
    )
  }

  // this was the fix, very hard to spot!
  function Counter(this: Handle) {
    let count = 0
    return () => (
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        This doesn't
      </button>
    )
  }
  ```

  The utility of being able to write `return (` instead of `() => (` has little benefit compared to the risks it created.

  - Both `handle` and `props` are optional arguments.
  - All components must return a function, there is no longer a distinction between stateful or stateless components

  ```tsx
  // "stateless" component before
  function SomeLayout({ children }: { children: RemixNode }) {
    return (
      <div>
        <h1>Some Title</h1>
        <main>{children}</main>
      </div>
    )
  }

  // after this change (returns a render function)
  function SomeLayout() {
    return ({ children }: { children: RemixNode }) => (
      <div>
        <h1>Some Title</h1>
        <main>{children}</main>
      </div>
    )
  }
  ```

  ##### The `setup` prop

  The `setup` prop exists primarily to keep regular props out of the setup scope, preventing accidental stale captures.

  When props were available in the setup scope it was easy to accidentally capture the initial value and then lose updates from parents.

  For example:

  ```tsx
  function Counter(
    this: Handle,
    // captured `label` in the wrong scope
    props: { label: string; initialCount: number },
  ) {
    let count = initialCount

    return () => (
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        {label /* stale! */} {count}
      </button>
    )
  }
  ```

  This was particularly troublesome when a component switched from stateless to stateful. If you forgot to shuffle the props from the setup scope to the newly created render scope, all of the props are now stale. It was also easy to define new props for an existing component in the setup scope when it should have been in the render scope.

  Now it's simply impossible to make these mistakes because the props aren't available in the setup scope at all.

  ```tsx
  function Counter(
    handle: Handle,
    // only the setup prop is passed here, no access to `label`
    setup: { count: number },
  ) {
    let count = setup.count

    return ({ label }: { label: string }) => (
      <button
        on={{
          click() {
            count++
            handle.update()
          },
        }}
      >
        {label} {count}
      </button>
    )
  }

  let el = <Counter setup={{ count: 10 }} label="Count" />
  ```

  Now, the only way to make a prop stale is to do it very intentionally:

  ```tsx
  // this is a bad example, showing the difficulty and ill-advised method of
  // making a prop value static by moving props into the setup scope
  function Counter(handle: Handle, setup: number) {
    let count = setup
    let initialLabel: string

    return (props: { label: string }) => {
      // what used to be an accident is now difficult to do on purpose
      if (!initialLabel) {
        initialLabel = props.label
      }
      return (
        <button
          on={{
            click: () => {
              count++
              handle.update()
            },
          }}
        >
          {initialLabel} {count}
        </button>
      )
    }
  }
  ```

  However, it is advised to use the setup prop if you intend for a value to be static, like `setup.count`. Props that are rendered should typically be props and not setup.

  ##### `this` binding removal

  We used `this` simply for its "optional first position" characteristic. Otherwise, it was difficult to decide which parameter should come first: handle or props?

  ```tsx
  // need handle but not props
  function PropsFirst(_: PropType, handle: Handle) {}

  // or with a reversed signature, need props but not handle
  function HandleFirst(_: Handle, props: PropType) {}
  ```

  Using `this` as an optional context argument solved the problem well:

  ```tsx
  function Neither() {}
  function Both(this: Handle, props: PropType) {}
  function OnlyHandle(this: Handle) {}
  function OnlyProps(props: PropType) {}
  ```

  This is no longer a concern since props have been removed from the setup scope because:

  - If you need `setup` then you are likely stateful
  - If you are stateful you need the handle
  - Therefore `setup` isn't useful without `handle`

  This affords a function signature that doesn't require skipping the first argument to get access to the second:

  ```tsx
  function OnlyHandle(handle: Handle) {}
  function Both(handle: Handle, setup: SomeInterface) {}
  function Neither() {}
  function OnlySetup(_: Handle, setup: SomeInterface) {
    // rare: unclear what setup would be used for without a handle
  }
  ```

  So without needing `this` for anything other than an optional first argument, we can remove the constraint. This allows for more flexible function syntax instead of requiring arrow function expressions everywhere inside a component.

  ```tsx
  function Counter(handle: Handle, setup: number) {
    let count = setup

    // function declarations inside the setup scope
    function updateCount() {
      count++
      handle.update()
    }

    return (props: { label: string }) => {
      return (
        <button
          on={{
            // object method shorthand
            click() {
              updateCount()
            },
          }}
        >
          {props.label} {count}
        </button>
      )
    }
  }
  ```

### Patch Changes

- Fix SVG namespace propagation through components

  Components rendered inside `<svg>` elements now correctly create SVG elements instead of HTML elements.

- Remove requirement for every element to have props

  Originally, `@remix/component` assumed that props will be an object, not `null` or `undefined`. This requirement has been removed and allows props to be nullish. This makes it easier to render `@remix/component` apps using alternative JSX templating tools like [`htm`](https://www.npmjs.com/package/htm).

## v0.2.1 (2025-12-19)

- Fix node replacement

  Anchors were being calculated incorrectly because it removed the old node before inserting the new one, Now it correctly uses the old node as the anchor for insertion and inserts the new node before removing the old one.

## v0.2.0 (2025-12-18)

- This is the initial release of the component package.

  See the [README](https://github.com/remix-run/remix/blob/main/packages/component/README.md) for more information.

## Unreleased

- Initial release
