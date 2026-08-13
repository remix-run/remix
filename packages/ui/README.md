# ui

Runtime UI primitives for Remix apps, including the component runtime, server rendering, frame hydration, reusable mixins, and headless first-party behavior primitives.

## Features

- Component runtime APIs for rendering, hydration, link and form frame navigation, and JSX
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

## Frame Navigation

Configure `resolveFrame` once to progressively enhance same-origin links and forms. The resolver owns the fetch request and receives native submission metadata for non-GET forms:

```tsx
import type { ResolveFrameOptions } from 'remix/ui'
import { run } from 'remix/ui'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, options) {
    return fetch(src, {
      headers: { Accept: 'text/html', 'X-Remix-Frame': 'true' },
      method: options?.method,
      body: getRequestBody(options),
      signal: options?.signal,
    })
  },
})

function getRequestBody(options?: ResolveFrameOptions): BodyInit | undefined {
  let formData = options?.formData
  if (!formData) return
  if (options.encType !== 'application/x-www-form-urlencoded') return formData

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}

await app.ready()
```

Forms remain ordinary HTML forms before the runtime starts. Add `rmx-target` to reload a named frame, or `rmx-document` to require a full-document submission:

```tsx
import { Frame } from 'remix/ui'

function AccountPage() {
  return () => (
    <>
      <Frame name="account" src="/account/edit" />
      <form action="/account/edit" method="post" rmx-target="account">
        <label for="display-name">Display name</label>
        <input id="display-name" name="displayName" required />
        <button type="submit">Save</button>
      </form>
    </>
  )
}
```

Native constraint validation and submitter overrides still apply. GET form values arrive in `src`; non-GET forms provide `formData`, `method`, and `encType` to the resolver. See [Frames](https://github.com/remix-run/remix/blob/main/packages/ui/docs/frames.md#form-navigation) for targeting, history behavior, request encoding, opt-outs, and server response guidance.

Use `rmx-history="push|replace"` on an enhanced anchor or form to control how the navigation updates history. This can override the automatic replacement used for non-GET form submissions to the current URL.

## Single-page Applications

Use `run` from `remix/ui/spa` when every route runs in the browser and returns a Remix UI tree
instead of an HTTP response body. `nodeResponse` keeps the router's standard `Request` to
`Response` contract while associating the response with a node for the top frame to render:

```tsx
import { createRouter } from 'remix/router'
import { nodeResponse, run } from 'remix/ui/spa'

let router = createRouter()

router.get('/', () => nodeResponse(<h1>Home</h1>))
router.get('/about', () => nodeResponse(<h1>About</h1>))

function LoadingPage() {
  return () => <p role="status">Loading…</p>
}

let app = run(router, { fallback: <LoadingPage /> })
await app.ready()
```

The optional `fallback` is a live Remix node displayed while the initial route loads.
`app.ready()` resolves after the initial URL has replaced it with the routed node. The runtime then
reuses frame navigation for same-origin links, forms, history traversal, redirects, cancellation,
and `rmx-target`.

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
