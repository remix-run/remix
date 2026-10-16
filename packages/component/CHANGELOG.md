# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

## v1.1.0

### Minor Changes

- Mixins that only add browser behavior can skip server rendering with `createMixin(setup, { ssr: false })`. The server skips their setup and render functions, including when another mixin returns them. The browser still initializes them during hydration and later renders. Server rendering remains enabled by default.

  ```tsx
  import { createMixin } from 'remix/component'

  const focusOnInsert = createMixin<HTMLElement>(
    (handle) => {
      handle.addEventListener('insert', ({ node }) => node.focus())
    },
    { ssr: false },
  )
  ```

  Use this option only when the mixin does not contribute to the server HTML. The built-in `on` and `ref` mixins now use it. `MixinOptions` is exported for typed options.

- Add options to frame.reload() to support setting the src and imperative frame submissions.
  - Reload a different source via `frame.reload({ src })` and skip `frame.src = "..."`
  - Submit data through a frame reload via `frame.reload({ method, encType, body })` without changing browser history
  - Like `<form>`, the method defaults to GET, which puts `FormData` fields in the source query; POST defaults to URL encoding, with multipart and plain-text encoding available through `encType`

- Disable automatic focus resets during intercepted navigation with `data-rmx-reset-focus="manual"` on links, forms, or submit buttons, or with `resetFocus: 'manual'` in `navigate()` and `link()` (see #11939).

  Scroll and focus controls accept the Navigation API values `"after-transition"` (the default) and `"manual"`. Use the same values for `resetScroll` and `resetFocus` options and `data-rmx-reset-scroll` and `data-rmx-reset-focus` attributes. Existing boolean options and `"true"` / `"false"` attributes remain supported: `true` corresponds to `"after-transition"` and `false` to `"manual"`.

### Patch Changes

- Fix frame navigation for forms whose submit button is removed immediately after submission, including buttons reused across forms while an earlier submission is still pending (see #11987). Preserve the original POST data across additional `FormData` snapshots and keep later canceled submissions on the same or another form from replacing the pending navigation.

- Fix server rendering so components rendered after a nested component subtree no longer reuse `handle.id` values from that subtree.

- Treat client entry `href` values as the same identity across HMR updates when they differ only by a cache-busting `t` timestamp query parameter.

- Include `unsafeHTML()` guidance in raw HTML prop errors (`innerHTML`, `srcDoc`, and `srcdoc`) and clarify that `outerHTML` is not supported on host elements.

- Preserve explicit and inferred generic component prop types in JSX, including components typed with partial handles (see #11942).

- Fix unintended input blur when frame updates remove or replace sibling content, such as when a search returns no results or its query is cleared (see #11939).

- Improve server rendering throughput and reduce temporary allocations by skipping unused mixin and attribute work, and closing responses directly when no frame content remains. Blocking frames still resolve before the first HTML chunk.

- Reduce server rendering work by writing ordinary HTML into a shared chunk list, awaiting blocking frames directly instead of scanning the rendered tree, skipping DOM event mixin setup, avoiding `delete` when merging `class` props, and inserting head resources and hydration data in a single pass before assembling the final document.

- Reduce server rendering memory use by assembling each HTML response with a single join and keeping client entry hydration props serialized. Request abort listeners are removed when rendering finishes, fails, or is canceled, so long-lived request signals no longer keep finished renders reachable.

- Streamed `<Frame>` content no longer loses items when the browser receives its template in multiple network chunks during initial page loading

- Restore scroll position when navigating back or forward to a page that previously used `resetScroll: false` or `data-rmx-reset-scroll="false"` (see #11989).

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
