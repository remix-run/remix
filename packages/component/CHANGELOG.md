# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

## v1.0.0

### Major Changes

- First stable release.

  BREAKING CHANGE: The component runtime has moved from `@remix-run/ui` back to `@remix-run/component`.

  The package provides a component runtime with browser rendering and hydration, server rendering, JSX runtimes, testing helpers, styles, and general-purpose mixins.

  ```tsx
  import { createRoot, css, on } from '@remix-run/component'
  ```

  Applications using the `remix` package can access the same APIs from `remix/component` and its corresponding subpaths.

  For consumers upgrading from `@remix-run/component@0.7`, the `addEventListeners`, `keysEvents`, `pressEvents`, and `PressEvent` root exports are no longer available. Animation APIs are now imported from `@remix-run/ui/animation`:

  ```diff
  -import { animateEntrance, spring } from '@remix-run/component'
  +import { animateEntrance, spring } from '@remix-run/ui/animation'
  ```

## v0.8.0

### Minor Changes

- BREAKING CHANGE: The component runtime has moved from `@remix-run/ui` back to `@remix-run/component`.

  The package provides a component runtime with browser rendering and hydration, server rendering, JSX runtimes, testing helpers, styles, and general-purpose mixins.

  ```tsx
  import { createRoot, css, on } from '@remix-run/component'
  ```

  Applications using the `remix` package can access the same APIs from `remix/component` and its corresponding subpaths.

  For consumers upgrading from `@remix-run/component@0.7`, the `addEventListeners`, `keysEvents`, `pressEvents`, and `PressEvent` root exports are no longer available. Animation APIs are now imported from `@remix-run/ui/animation`:

  ```diff
  -import { animateEntrance, spring } from '@remix-run/component'
  +import { animateEntrance, spring } from '@remix-run/ui/animation'
  ```
