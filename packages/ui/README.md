# ui

Runtime UI primitives for Remix apps, including the component runtime, server rendering, frame hydration, reusable mixins, and headless first-party behavior primitives.

## Features

- Component runtime APIs for rendering, hydration, frame navigation, and JSX
- A client-only `SPA` component that renders URLs through a URL-to-node router
- Server rendering APIs for streaming Remix UI trees and frames
- `mix` composition with event, ref, CSS, and animation helpers
- Headless behavior primitives for controls such as menus, listboxes, popovers, selects, and comboboxes
- Lower-level utilities for keyboard events, typeahead search, refs, attributes, and CSS transition timing

## Installation

```sh
npm i remix
```

## Usage

Compose behavior primitives with your own markup and styles:

```tsx
import { css } from 'remix/ui'
import * as popover from 'remix/ui/popover'

let triggerCss = css({
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '6px 10px',
})

let surfaceCss = css({
  background: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '8px',
})

function ViewOptions() {
  let open = false

  return () => (
    <popover.Context>
      <button
        mix={[triggerCss, popover.anchor({ placement: 'bottom-end' }), popover.focusOnHide()]}
        onClick={() => {
          open = true
        }}
        type="button"
      >
        View options
      </button>
      <div
        mix={[
          surfaceCss,
          popover.surface({
            open,
            onHide() {
              open = false
            },
          }),
        ]}
      >
        Panel content
      </div>
    </popover.Context>
  )
}
```

Button styling is available as a composable mixin:

```tsx
import button from 'remix/ui/button'

function Actions() {
  return () => <button mix={button({ tone: 'primary' })}>Create project</button>
}
```

Use `SPA` with a router that maps URLs directly to Remix UI nodes:

```tsx
import { createRouter } from 'remix/router'
import { createRoot, SPA, type RemixNode } from 'remix/ui'

declare module 'remix/router' {
  interface RouterTypes {
    output: RemixNode
  }
}

let router = createRouter({ defaultHandler: () => null })
router.get('/', () => <h1>Home</h1>)

let root = createRoot(document.body)
root.render(<SPA router={router} fallback="Loading…" />)
```

`SPA` intercepts same-origin browser navigations, exposes the active and pending URLs through its component context, and forwards navigation cancellation to `router.fetch(url, { signal })`. It also forwards intercepted form submissions as `POST` requests with their `FormData`. Navigation history entries do not retain submitted `FormData`, so back and forward navigations revisit form destinations with GET requests. Form destinations should therefore accept both GET and POST.

## Preserving Client-Owned DOM

Use `rmx-preserve-dom` on the smallest element whose live DOM should belong to client code after initial render, such as a custom element or third-party widget:

```tsx
<pagefind-ui data-key="search" rmx-preserve-dom>
  <button type="button">Search</button>
</pagefind-ui>
```

Remix UI still renders the element's children during SSR and still hydrates any initial client entries inside it. On later frame reloads, matched `rmx-preserve-dom` elements keep their current attributes and children instead of accepting incoming DOM updates. See [Preserving client-owned DOM](https://github.com/remix-run/remix/blob/main/packages/ui/docs/frames.md#preserving-client-owned-dom) for guidance and caveats.

## Cascade Layers

Remix UI emits generated `css(...)` rules under the `rmx` cascade layer. Unlayered CSS outranks layered CSS, so use explicit layer order when mixing Remix UI with global styles.

Put layers that should lose to Remix UI before `rmx`:

```css
@layer base, rmx;

@layer base {
  button,
  input,
  textarea,
  select {
    font: inherit;
    margin: 0;
    padding: 0;
  }
}
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
