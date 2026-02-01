# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

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
