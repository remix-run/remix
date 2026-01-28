# `interaction` CHANGELOG

This is the changelog for [`interaction`](https://github.com/remix-run/remix/tree/main/packages/interaction). It follows [semantic versioning](https://semver.org/).

## v0.5.0

### Minor Changes

- BREAKING CHANGE: Removed `onError` option from `createContainer`. Errors thrown in event listeners now dispatch an `ErrorEvent` on the target element with `bubbles: true`, allowing them to propagate up the DOM tree. Also removed the `raise` method from the `Interaction` interface.

## v0.4.0

### Minor Changes

- BREAKING CHANGE: Interaction setup functions now receive `handle` as a parameter instead of using `this` context

  Interaction setup functions now receive the `Interaction` handle as a parameter:

  ```ts
  // Before
  function MyInteraction(this: Interaction) {
    this.on(this.target, { ... })
  }

  // After
  function MyInteraction(handle: Interaction) {
    handle.on(handle.target, { ... })
  }
  ```

  This change affects all custom interactions created with `defineInteraction()`.

## v0.3.0 (2025-11-20)

- BREAKING CHANGE: removed `Tab` key interaction
- Fix: key interactions only apply to their own key
- Fix: export `TypedEventTarget` instead of just the type interface
- Fix: SVG element event type inference

## v0.2.1 (2025-11-19)

- Exclude test files from published npm package

## v0.2.0 (2025-11-18)

- BREAKING CHANGE: Interaction API refactor - interactions now use `this` context with `this.on()`, `this.target`, `this.signal`, and `this.raise`

  Interactions are now functions that receive an `Interaction` context via `this`:

  ```ts
  // Before
  function MyInteraction(target: EventTarget, signal: AbortSignal) {
    createContainer(target, { signal }).set({ ... })
  }

  // After
  function MyInteraction(this: Interaction) {
    this.on(this.target, { ... })
    // or for different targets
    this.on(this.target.ownerDocument, { ... })
  }
  ```

  The `Interaction` context provides:

  - `this.target` - The target element
  - `this.signal` - Abort signal for cleanup
  - `this.raise` - Error handler (renamed from `onError`)
  - `this.on(target, listeners)` - Create a container with automatic signal/error propagation

- BREAKING CHANGE: Simplify descriptor API - descriptors now extend `AddEventListenerOptions` directly

  Removed `capture()` and `listenWith()` helper functions. Consumers now provide options inline using descriptor objects:

  ```tsx
  // removed
  capture((event) => {})
  listenWith({ once: true }, (event) => {})

  // new API
  {
    capture: true,
    listener(event) {}
  }
  {
    once: true,
    listener(event) {}
  }
  ```

- BREAKING CHANGE: Remove `on` signal overload, just use containers directly

  ```tsx
  // removed
  on(target, signal, listeners)

  // on is just a shortcut now
  let dispose = on(target, listeners)
  dispose()

  // use containers for signal cleanup
  let container = createContainer(target, { signal })
  ```

- Added `onError` handler so containers can handle listener errors in one place (avoids Remix Component needing to wrap EventListener interfaces to raise to `<Catch>`)

  ```tsx
  createContainer(target, {
    onError(error) {
      // handle error
    },
  })
  ```

## v0.1.0 (2025-11-03)

This is the initial release of the `@remix-run/interaction` package.

See the [README](https://github.com/remix-run/remix/blob/main/packages/interaction/README.md) for more details.
