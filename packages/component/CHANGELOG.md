# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

## v1.1.0

### Minor Changes

- Add options to frame.reload() to support setting the src and imperative frame submissions.
  - Reload a different source via `frame.reload({ src })` and skip `frame.src = "..."`
  - Submit data through a frame reload via `frame.reload({ method, encType, body })` without changing browser history
  - Like `<form>`, the method defaults to GET, which puts `FormData` fields in the source query; POST defaults to URL encoding, with multipart and plain-text encoding available through `encType`

- Disable automatic focus resets during intercepted navigation with `data-rmx-reset-focus="manual"` on links, forms, or submit buttons, or with `resetFocus: 'manual'` in `navigate()` and `link()`. The focus setting carries through history replacements, redirects, and back/forward navigation (see #11939).

  Scroll and focus controls accept the Navigation API values `"after-transition"` (the default) and `"manual"`. Use the same values for `resetScroll` and `resetFocus` options and `data-rmx-reset-scroll` and `data-rmx-reset-focus` attributes. Existing boolean options and `"true"` / `"false"` attributes remain supported: `true` corresponds to `"after-transition"` and `false` to `"manual"`. Navigation history supports both preferred string values and legacy boolean settings without rewriting them when navigating back or forward.

### Patch Changes

- Preserve explicit and inferred generic component prop types in JSX, including components typed with partial handles (see #11942).

- Fix unintended input blur when frame updates remove or replace sibling content, such as when a search returns no results or its query is cleared (see #11939).

- Streamed `<Frame>` content no longer loses items when the browser receives its template in multiple network chunks during initial page loading

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
