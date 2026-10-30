# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

## v1.1.1

### Patch Changes

- Preserve literal doctype-looking text in scripts, styles, textareas, attributes, and comments when parsing frame HTML in the browser, including full-document reloads and streamed frame templates. ([#12107](https://github.com/remix-run/remix/pull/12107))

- Fix hydration of `clientEntry` components whose props contain JSX elements styled with `css()`. Hydration used to fail with `Framework invariant: Invalid mix prop`, and the client entry never became interactive. `css()` mixins in client entry props, including arrays like `mix={[css(base), css(active)]}`, now reach the browser with their styles, and content from those props that the server didn't render is styled when the client entry renders it later. Styles with `undefined` properties keep the same generated classes and cascade order through hydration. ([#12125](https://github.com/remix-run/remix/pull/12125))

  Other mixins, such as `on()`, `ref()`, and custom mixins from `createMixin()`, are not supported in serialized client entry props. When a client entry renders an element from its props that uses one, it now reports an error explaining that only `css()` mixins can be serialized and that those elements should be rendered inside the client entry instead, rather than failing with `Invalid mix prop`.

- Fix how `css()` and the `style` prop serialize property names and numeric values. Previously `css({ WebkitLineClamp: 4 })` rendered the invalid `-webkit-line-clamp: 4px`, and the `webkitLineClamp` key suggested by the DOM types rendered `webkit-line-clamp`, which browsers ignore. ([#12121](https://github.com/remix-run/remix/pull/12121))
  - Numeric values stay unitless wherever the supported CSS grammar accepts a bare number, including vendor-prefixed forms, mask borders, hyphenation limits, `shapeImageThreshold`, `readingOrder`, and numeric shorthands such as `animation` and `borderImage`. The list covers current and draft grammars as well as legacy properties; browser support still depends on the property.
  - Vendor-prefixed camelCase keys get their leading dash, so `webkitLineClamp` and `msFlex` render as `-webkit-line-clamp` and `-ms-flex`.
  - Custom property names keep their casing, so `'--gapSize'` renders as `--gapSize` instead of `--gap-size`.
  - `css()` drops `NaN` and `Infinity` values instead of rendering `NaNpx` or `Infinitypx`, matching the `style` prop.

  **Behavior change:** these fixes change some existing output. Apps that relied on the old output need to update:
  - Custom property names written in camelCase are no longer converted to kebab case. If a stylesheet or `var()` reads the kebab-case name, write the property the way you reference it:

    ```diff
    -css({ '--gapSize': '8px', gap: 'var(--gap-size)' })
    +css({ '--gap-size': '8px', gap: 'var(--gap-size)' })
    ```
  - `css()` adds `px` to plain numbers, but it also added it to `flex`, where a number means a grow factor. `flex: 2` rendered as `flex: 2px`, which grows like `flex: 1` with a `2px` basis, so numbers other than `1` had no effect on growth. `flex` numbers are now grow factors, and `flex: 1` renders `1 1 0%` instead of `1 1 1px`.
  - `tabSize: 4` now means four spaces instead of `4px`. Numbers for `borderImageWidth`, `borderImageOutset`, `maskBorderWidth`, and `maskBorderOutset` multiply the border width instead of being pixels; the WebKit mask-box-image aliases follow the same convention.
  - Numeric shorthands select their unitless meaning: `animation: 2` sets two iterations, and `borderImage: 2` / `maskBorder: 2` set the slice. Use strings with units for durations and angles, such as `'200ms'` and `'45deg'`.
  - To request pixels explicitly, use a string:

    ```diff
    -css({ tabSize: 4, borderImageWidth: 2 })
    +css({ tabSize: '4px', borderImageWidth: '2px' })
    ```

## v1.1.0

### Minor Changes

- Mixins that only add browser behavior can skip server rendering with `createMixin(setup, { ssr: false })`. The server skips their setup and render functions, including when another mixin returns them. The browser still initializes them during hydration and later renders. Server rendering remains enabled by default. ([#12019](https://github.com/remix-run/remix/pull/12019))

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

- `frame.reload()` accepts options to reload a different source or submit data to the frame without changing browser history. Pass `src` to reload another source in one call instead of assigning `frame.src` first, and pass `method`, `encType`, and `body` to send `FormData` through the frame resolver and render its response. ([#11938](https://github.com/remix-run/remix/pull/11938))

  ```tsx
  let body = new FormData()
  body.set('displayName', 'Ada')
  await handle.frames.get('account')?.reload({ src: '/account/edit', method: 'post', body })
  ```

  Like `<form>`, the method defaults to GET, which puts the `FormData` fields in the source's query string. POST defaults to URL encoding, and `encType` selects `multipart/form-data` or `text/plain`. See [Reload requests](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#reload-requests) for details.

- Prefetch frame content with `data-rmx-prefetch="intent"` on hover, focus, or press; `data-rmx-prefetch="viewport"` on viewport entry; or `prefetch(src, options?)` from a script. Named-frame links honor `data-rmx-target` and `data-rmx-src`; imperative calls accept `{ target }`. Automatic link prefetching respects Save-Data and skips `slow-2g`/`2g` connections. ([#12004](https://github.com/remix-run/remix/pull/12004))

  The default discovers JavaScript, CSS, and explicit image and font preloads from destination HTML, using asset prefetch hints and the browser HTTP cache. Customize loading with `run({ prefetch })`. See the [prefetching guide](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#prefetching) for usage and caching details.

- Disable automatic focus resets during intercepted navigation with `data-rmx-reset-focus="manual"` on links, forms, or submit buttons, or with `resetFocus: 'manual'` in `navigate()` and `link()`. ([#11939](https://github.com/remix-run/remix/pull/11939))

  Scroll and focus controls accept the Navigation API values `"after-transition"` (the default) and `"manual"`. Use the same values for `resetScroll` and `resetFocus` options and `data-rmx-reset-scroll` and `data-rmx-reset-focus` attributes. Existing boolean options and `"true"` / `"false"` attributes remain supported: `true` corresponds to `"after-transition"` and `false` to `"manual"`.

### Patch Changes

- Fix frame navigation for forms whose submit button is removed immediately after submission, including buttons reused across forms while an earlier submission is still pending. Preserve the original POST data across additional `FormData` snapshots and keep later canceled submissions on the same or another form from replacing the pending navigation. ([#11987](https://github.com/remix-run/remix/pull/11987))

- Fix server rendering so components rendered after a nested component subtree no longer reuse `handle.id` values from that subtree. ([#12016](https://github.com/remix-run/remix/pull/12016))

- Treat client entry `href` values as the same identity across HMR updates when they differ only by a cache-busting `t` timestamp query parameter. ([#11980](https://github.com/remix-run/remix/pull/11980))

- Include `unsafeHTML()` guidance in raw HTML prop errors (`innerHTML`, `srcDoc`, and `srcdoc`) and clarify that `outerHTML` is not supported on host elements. ([#11988](https://github.com/remix-run/remix/pull/11988))

- Preserve explicit and inferred generic component prop types in JSX, including components typed with partial handles. ([#11942](https://github.com/remix-run/remix/pull/11942))

- Fix unintended input blur when frame updates remove or replace sibling content, such as when a search returns no results or its query is cleared. ([#11939](https://github.com/remix-run/remix/pull/11939))

- Server rendering is about twice as fast and uses less memory, with unchanged HTML output. Rendering a 48-product listing page with `renderToString()` takes 244 µs instead of 513 µs compared to `@remix-run/component` 1.0.0 (Node.js 24.18 on an Apple M5 Pro, median of 5 fresh-process runs). Under sustained HTTP load on a 24-product store page, assembling each response with a single join lowers the server's resident memory after load from 793 MiB to 527 MiB (see #12016, #12018, and #12020). ([#12006](https://github.com/remix-run/remix/pull/12006))

  The renderer no longer creates a promise per static node, skips setup for browser-only mixins such as `on()`, and inserts head resources and hydration data in a single pass. Blocking frames still resolve before the first HTML chunk. Request abort listeners are now removed when rendering finishes, fails, or is canceled, so long-lived request signals no longer keep finished renders reachable.

- Fix `clientEntry` props that contain JSX fragments, including components that render fragments, so their content is no longer serialized as `null` and dropped once the entry re-renders on the client (see #12065). String and number `key`s on elements and fragments in `clientEntry` props are now preserved too, so reordering keyed content after hydration moves the existing DOM nodes instead of patching them in place. Other key types still can't round-trip through JSON, so they are omitted and those elements fall back to matching by position. ([#12067](https://github.com/remix-run/remix/pull/12067))

- Streamed `<Frame>` content no longer loses items when the browser receives its template in multiple network chunks during initial page loading. ([#11975](https://github.com/remix-run/remix/pull/11975))

- Fix back and forward navigations in Chromium that sometimes jumped down the page right after restoring the scroll position. Scroll anchoring now stays disabled until after the first paint following the navigation, instead of turning back on in the same frame the page shrinks to its restored height. ([#12009](https://github.com/remix-run/remix/pull/12009))

- Restore scroll position when navigating back or forward to a page that previously used `resetScroll: false` or `data-rmx-reset-scroll="false"`. ([#11989](https://github.com/remix-run/remix/pull/11989))

- Fix frame navigations in iOS Safari that could open the next page scrolled to the bottom after scrolling down the previous page. Safari restored the previous scroll position for several frames after the navigation reset it; Remix now undoes those restorations until shortly after the navigation finishes, the user interacts with the page, or another navigation starts. ([#12011](https://github.com/remix-run/remix/pull/12011))

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
