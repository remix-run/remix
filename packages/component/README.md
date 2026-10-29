# component

A minimal component system built on JavaScript and DOM primitives. Write components that render on
the server, stream to the browser, and hydrate only where you need interactivity.

## Features

- Component runtime APIs for rendering, hydration, link and form frame navigation, and JSX
- Server rendering APIs for streaming component trees and frames
- `mix` composition with event, ref, and CSS helpers
- Lower-level utilities for events, refs, attributes, and rendering lifecycle

## Installation

```sh
npm i remix
```

## Usage

Components receive a handle and return a render function. Local state stays in ordinary JavaScript
variables, and `handle.update()` explicitly schedules another render:

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function Counter(handle: Handle<{ initialCount?: number }>) {
  let count = handle.props.initialCount ?? 0

  return () => (
    <button
      type="button"
      mix={on('click', () => {
        count++
        void handle.update()
      })}
    >
      Count: {count}
    </button>
  )
}
```

## Components

A component is a function that receives a `handle` and returns a render function. The outer function is the setup scope. It runs once per component instance, so variables declared there persist for the instance's lifetime. The render function runs on the first render and again on every update:

```tsx
import type { Handle } from 'remix/component'

function Price(handle: Handle<{ amount: number; currency: string }>) {
  // Setup: runs once per instance
  let format = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: handle.props.currency,
  })

  // Render: runs on the first render and on every update
  return () => <span>{format.format(handle.props.amount)}</span>
}
```

Values read from `handle.props` during setup are the initial props. `Price` keeps its first `currency` even if the parent later passes a different one, while `amount` updates because render reads it. Read props inside render, or inside callbacks, whenever the component should follow changes.

### Lifecycle

1. **First render:** The runtime calls the component function with a handle whose `props` are already set, then calls the returned render function. After the result is committed to the DOM, tasks queued with `handle.queueTask()` run.
2. **Updates:** The runtime replaces the values on `handle.props` and calls the render function again. Setup does not run again. Tasks queued during the update run after the commit.
3. **Removal:** `handle.signal` is aborted, so listeners registered with `{ signal: handle.signal }` are removed. Queued tasks that haven't run yet still run, with an aborted signal.

During server rendering, setup and render run, but `handle.update()` throws and `handle.queueTask()` does nothing. Start timers, read the DOM, and do other browser-only work in queued tasks, event handlers, or mixin lifecycle events.

## Handle

| Member                   | Use                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handle.props`           | The current props. The object stays the same across renders, and its values are replaced before each render.                                                                                   |
| `handle.update()`        | Schedules a render. Returns a promise that resolves with an `AbortSignal` after the update commits. The signal is aborted when the component renders again or is removed.                      |
| `handle.queueTask(task)` | Runs `task` after the next commit. The task receives an `AbortSignal` that is aborted when the component renders again or is removed.                                                          |
| `handle.signal`          | Aborted when the component is removed. Use it to clean up work started in setup.                                                                                                               |
| `handle.id`              | A stable ID for the instance, for `htmlFor`, `aria-controls`, and similar attributes.                                                                                                          |
| `handle.context`         | Provides values to descendants and reads values from ancestors. See [Context](#context).                                                                                                       |
| `handle.frame`           | The nearest [frame](#frame-navigation). Call `handle.frame.reload()` to fetch its content again.                                                                                               |
| `handle.frames`          | `handle.frames.top` is the root frame of the runtime tree. `handle.frames.get(name)` finds a mounted frame by its `name` prop, or returns `undefined` when no frame with that name is mounted. |

### Updates

Call `handle.update()` from event handlers, queued tasks, timers, and subscriptions. Calling it during setup warns and skips the extra render, because the first render follows setup anyway. Calling it during render throws. When render discovers work that should happen after the commit, queue it with [`handle.queueTask()`](#queued-tasks).

Await `handle.update()` when the next step needs the updated DOM:

```tsx
import { on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

function Disclosure(handle: Handle) {
  let open = false
  let closeButton: HTMLButtonElement

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', async () => {
          open = true
          await handle.update()
          closeButton.focus()
        })}
      >
        Show details
      </button>
      {open && (
        <div role="region">
          <button type="button" mix={ref((node) => (closeButton = node))}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
```

### Queued Tasks

`handle.queueTask(task)` runs `task` after the next commit, once the rendered output is in the DOM. Use it for work that render discovers but can't do itself, such as loading data for a prop, measuring layout, or moving focus. Queued tasks never run during server rendering.

The task receives an `AbortSignal` that is aborted when the component renders again or is removed. A task queued from render is queued again on every render, so guard it with the prop value it depends on. Otherwise the task's own `handle.update()` renders again and queues the work again:

```tsx
import type { Handle } from 'remix/component'

function UserCard(handle: Handle<{ userId: string }>) {
  let user: { name: string } | undefined
  let error: string | undefined
  let loadedId: string | undefined

  return () => {
    let { userId } = handle.props
    let loading = userId !== loadedId

    if (loading) {
      handle.queueTask(async (signal) => {
        try {
          let response = await fetch(`/api/users/${userId}`, { signal })
          let data = await response.json()
          if (signal.aborted) return
          user = data
          error = undefined
        } catch (caught) {
          if (signal.aborted) return
          error = caught instanceof Error ? caught.message : 'Failed to load user'
        }
        loadedId = userId
        handle.update()
      })
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>
    return <p>{user?.name}</p>
  }
}
```

When `userId` changes, the next render aborts the previous request and queues one for the new ID. Any other render while a request is in flight also aborts it, and that render queues it again, so only the latest request for the current `userId` completes. Catch errors inside async tasks. Remix doesn't handle a rejected task, and aborting a `fetch()` rejects it.

### Abort Signals

Each signal covers a different lifetime. Pass the narrowest one to `fetch()` and other cancellable work:

| Signal                                   | Aborted when                                           |
| ---------------------------------------- | ------------------------------------------------------ |
| The second argument to an `on()` handler | The same handler runs again, or its element is removed |
| The argument to a queued task            | The component renders again, or is removed             |
| The signal resolved by `handle.update()` | The component renders again, or is removed             |
| `handle.signal`                          | The component is removed                               |

### Context

A provider declares its context type as the second `Handle` type parameter and calls `handle.context.set(value)`. Descendants read the value with `handle.context.get(Provider)`:

```tsx
import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

function Settings(handle: Handle<{ children?: RemixNode }, { compact: boolean }>) {
  let compact = false
  handle.context.set({ compact })

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', () => {
          compact = !compact
          handle.context.set({ compact })
          handle.update()
        })}
      >
        Toggle density
      </button>
      {handle.props.children}
    </div>
  )
}

function Row(handle: Handle<{ label: string }>) {
  return () => {
    let { compact } = handle.context.get(Settings)
    return <li style={{ padding: compact ? '2px' : '8px' }}>{handle.props.label}</li>
  }
}
```

- Context is keyed by the provider component itself. `get(Settings)` reads the nearest ancestor rendered by exactly `Settings`, so a nested `Settings` shadows an outer one, and different providers never collide.
- `set()` replaces the value but doesn't schedule a render. Call `handle.update()` on the provider when descendants should render with the new value.
- Read context inside render when the provider replaces its value. A value read during setup stays the value from that setup call. A stable object that the provider never replaces, such as a `TypedEventTarget` from `remix/component`, can be read once in setup and subscribed to.
- At runtime, `get()` returns `undefined` when no matching provider is an ancestor.

When several public components should provide the same logical scope, render one shared provider from each of them, so descendants read a single provider type regardless of which component wraps them:

```tsx
import type { Handle, RemixNode } from 'remix/component'

function MenuScope(handle: Handle<{ children?: RemixNode }, { id: string }>) {
  handle.context.set({ id: handle.id })
  return () => handle.props.children
}

function MenuRoot(handle: Handle<{ children?: RemixNode }>) {
  return () => <MenuScope>{handle.props.children}</MenuScope>
}

function MenuGroup(handle: Handle<{ children?: RemixNode }>) {
  return () => <MenuScope>{handle.props.children}</MenuScope>
}

function MenuTrigger(handle: Handle) {
  let scope = handle.context.get(MenuScope)
  return () => <button aria-controls={scope.id}>Open</button>
}
```

### Frames From Components

`handle.frame` is the frame that contains the component. Use `handle.frames.top` when a nested component needs to reload the whole page instead of only its nearest frame:

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function RefreshAllButton(handle: Handle) {
  return () => (
    <button
      type="button"
      mix={on('click', async () => {
        await handle.frames.top.reload()
      })}
    >
      Refresh everything
    </button>
  )
}
```

`handle.frames.get(name)` finds a mounted frame by name. If several mounted frames share a name, it returns the most recently mounted one.

## Keys

Give list items a `key` when a list can be reordered, filtered, or added to. Elements and components with matching keys are moved instead of recreated, so they keep:

- their DOM nodes
- component state in setup scope
- focus and text selection
- input values the user has typed

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function ReorderableList(handle: Handle) {
  let items = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
    { id: 'c', label: 'Item C' },
  ]

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', () => {
          items = [...items].reverse()
          handle.update()
        })}
      >
        Reverse list
      </button>
      {items.map((item) => (
        <div key={item.id}>
          <input type="text" defaultValue={item.label} />
        </div>
      ))}
    </div>
  )
}
```

Keys can be strings, numbers, or bigints, and must be unique among siblings. Use stable IDs from your data. An array index works only if the list never reorders, and a value created during render, such as `Math.random()`, makes every render look like a new item.

## Styling

`css(...)` turns a style object into a generated class and applies it through `mix`. The object mirrors CSS nesting:

```tsx
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

const toggleStyle = css({
  display: 'inline-flex',
  gap: '6px',
  padding: '8px 12px',
  border: '1px solid #d6d6d6',
  borderRadius: '6px',
  background: 'white',
  '&:hover': {
    borderColor: '#6d28d9',
  },
  '&[aria-pressed="true"]': {
    background: '#6d28d9',
    color: 'white',
  },
  '&::after': {
    content: '"✓"',
    visibility: 'hidden',
  },
  '&[aria-pressed="true"]::after': {
    visibility: 'visible',
  },
  '.label': {
    fontWeight: 600,
  },
  '@media (max-width: 40rem)': {
    padding: '12px 16px',
  },
})

function FavoriteToggle(handle: Handle) {
  let pressed = false

  return () => (
    <button
      type="button"
      aria-pressed={pressed}
      mix={[
        toggleStyle,
        on('click', () => {
          pressed = !pressed
          handle.update()
        }),
      ]}
    >
      <span class="label">Favorite</span>
    </button>
  )
}
```

### Nested Selectors

- `&` refers to the element itself, as in `'&:hover'`, `'&::before'`, `'&[aria-pressed="true"]'`, and `'& h2'`.
- Class names nest directly. `'.label'` styles descendants with the `label` class.
- Nested keys must start with `&`, `.`, `:`, `[`, or `@`. A bare element selector such as `h2` isn't treated as a selector, so write `'& h2'`.
- `@media`, `@supports`, and other at-rules can nest at any level.

Prefer state selectors such as `'&:hover .label'` or `'&[aria-expanded="true"]'` over tracking hover or focus in JavaScript and rendering again. The browser applies them without a render, and they work before the page hydrates.

### Dynamic Values

Each distinct style object becomes its own class and rule. Use `css(...)` for styles that come from a small set of states, and the `style` prop for values that change continuously, such as progress, coordinates, or transforms:

```tsx
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

const barStyle = css({ height: '4px', background: '#6d28d9', transformOrigin: 'left' })

function ProgressBar(handle: Handle<{ value: number }>) {
  return () => <div mix={barStyle} style={{ transform: `scaleX(${handle.props.value})` }} />
}
```

During server rendering, Remix collects the generated rules, deduplicates them, and puts them in `<style data-rmx-style>` tags in the document head, so server-rendered pages are styled before any JavaScript loads.

### Combining Styles

`mix` can hold several `css(...)` styles, and each one keeps its own class. When two of them set the same property, their order in `mix` does not decide which one wins. Each class takes its place in the cascade the first time it's added to the page, so the winner depends on which style rendered first:

```tsx
import { css } from 'remix/component'

const buttonStyle = css({ background: 'gray' })
const dangerStyle = css({ background: 'red' })

function DeleteButton() {
  // The background depends on which style the page inserted first, not on this order
  return () => <button mix={[buttonStyle, dangerStyle]}>Delete</button>
}
```

Combine styles that set different properties, such as layout and appearance. For variants, put the variant in one style behind a selector, or pass different values to a single `css(...)` call:

```tsx
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

const buttonStyle = css({
  background: 'gray',
  '&[data-variant="danger"]': {
    background: 'red',
  },
})

function Button(handle: Handle<{ label: string; variant?: 'danger' }>) {
  return () => (
    <button data-variant={handle.props.variant} mix={buttonStyle}>
      {handle.props.label}
    </button>
  )
}
```

### Cascade Layers

The component runtime emits generated `css(...)` rules under the `rmx` cascade layer. Each generated class gets its own sublayer, so a class such as `rmxc-k4a9f` is emitted as `@layer rmx.rmxc-k4a9f { ... }`. That keeps each class's place in the cascade the same across every root and frame on the page.

Unlayered CSS outranks layered CSS, so use explicit layer order when mixing generated styles with global styles. Put layers that should lose to generated styles before `rmx`:

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

For imported stylesheets, assign the layer in the import when your build supports it:

```css
@layer base, rmx;
@import './base.css' layer(base);
```

## Custom Mixins

Use `createMixin(...)` to share host behavior, manage DOM resources, or provide default props. The [Mixins guide](https://github.com/remix-run/remix/blob/main/packages/component/docs/mixins.md) covers setup and render, `MixinHandle`, lifecycle events, and deferred removal with `beforeRemove` and `event.persistNode(...)`.

For behavior that does not affect server HTML, pass `{ ssr: false }` to skip setup and render on the server:

```tsx
import { createMixin } from 'remix/component'

const focusOnInsert = createMixin<HTMLElement>(
  (handle) => {
    handle.addEventListener('insert', ({ node }) => node.focus())
  },
  { ssr: false },
)
```

## Client Entry Loading

`run()` hydrates client entries by calling `loadModule` for each component module:

```tsx
import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
})

await app.ready()
```

Client entries introduced after the initial document may depend on import maps added at runtime.
When targeting browsers without native support for multiple import maps, use
`remix/multiple-import-maps-polyfill` to load these modules and process their preloads:

```tsx
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await importModule(moduleUrl)
    let Component = module[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})
```

## Frame Navigation

The same runtime represents the current document as `app.frames.top` and intercepts eligible
same-origin links and forms through the browser's Navigation API. Those navigations fetch HTML with
the frame resolver and update the existing document in place instead of loading a new document.
This soft-navigation behavior applies even when the page only uses `clientEntry()` and does not
render an explicit `<Frame>`.

Frame navigation requires both `window.navigation` and `NavigateEvent.sourceElement`. Browsers
missing either capability use document navigation for links, forms, and `navigate()`. Hydration and
explicit frame reloads still work.

The default resolver sends `X-Remix-Frame: true` for every request, including top-frame navigation and reloads. Named frames also send `X-Remix-Target`; top-frame and unnamed frame requests omit the target. It only fetches same-origin sources and follows same-origin redirects.

The default browser resolver omits `X-Remix-Top-Frame-Src`. When `render()` middleware handles these requests, the server-rendered `handle.frames.top.src` defaults to the requested frame's URL.

The default resolver is equivalent to:

```js
async function resolveFrame(src, options) {
  let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
  if (options?.target != null) headers.set('X-Remix-Target', options.target)

  let { body, encType } = getRequestBody(options)
  if (encType) headers.set('Content-Type', encType)
  let requestInit = {
    body,
    headers,
    method: options?.method,
    mode: 'same-origin',
    signal: options?.signal,
  }
  let response = await fetch(src, requestInit)

  let isHtml = response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
  if (response.status >= 500 || (response.status >= 300 && !isHtml)) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
  }

  return response
}

function getRequestBody(options) {
  let formData = options?.formData
  if (!formData) return {}
  if (['get', 'head'].includes((options?.method ?? 'get').toLowerCase())) return {}

  let encType = options?.encType?.toLowerCase()

  if (encType === 'multipart/form-data') return { body: formData }

  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return { body: new Blob([body], { type: 'text/plain' }), encType: 'text/plain' }
  }

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(
      normalizeLineBreaks(name),
      normalizeLineBreaks(typeof value === 'string' ? value : value.name),
    )
  }
  return { body, encType: 'application/x-www-form-urlencoded' }
}

function normalizeLineBreaks(value) {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}
```

The default resolver requests HTML. GET form values are already encoded in `src`;
`application/x-www-form-urlencoded` submissions use `URLSearchParams`, `text/plain` submissions use
CRLF-delimited text, and `multipart/form-data` submissions use `FormData`. Pass a custom
`resolveFrame` when the server requires additional headers, another body encoding, or a different
response policy.

Scroll and focus controls accept the Navigation API values `"after-transition"` (the default) and `"manual"`. Set `data-rmx-reset-scroll="manual"` or `data-rmx-reset-focus="manual"` on a link or form to disable the corresponding automatic behavior. The equivalent options for `navigate()` and `link()` are `resetScroll: 'manual'` and `resetFocus: 'manual'`:

```tsx
<a href="/search?page=2" data-rmx-reset-scroll="manual" data-rmx-reset-focus="manual">
  Next page
</a>
```

Existing boolean options and `"true"` / `"false"` attribute values remain supported: `true` corresponds to `"after-transition"` and `false` to `"manual"`.

Add `data-rmx-document` to a link or form to leave that navigation to the browser. To keep all links
and forms as document navigations while still hydrating client entries and using explicit frames,
register a listener before calling `run()`:

```ts
window.navigation?.addEventListener('navigate', (e) => e.stopImmediatePropagation())
```

This prevents Remix from intercepting Navigation API events. Explicit frame reloads such as
`handle.frame.reload()` continue to use the frame resolver.

The default resolver accepts `2xx` responses and `3xx` or `4xx` responses whose `Content-Type` includes `text/html`, ignoring case. It rejects other `3xx` or `4xx` responses and all `5xx` responses with an error containing their status and status text. A custom `resolveFrame` may return a `Response` with any status when it wants the component runtime to render the response body.

Links and forms remain ordinary HTML elements before the runtime starts. Use `data-rmx-target` to reload a named frame, `data-rmx-src` to fetch a different same-origin URL for that named frame while keeping `href` or `action` as the browser destination, or `data-rmx-document` to force a full-document navigation:

```tsx
import { Frame } from 'remix/component'

function AccountPage() {
  return () => (
    <>
      <Frame name="account" src="/account/edit" />
      <form action="/account/edit" method="post" data-rmx-target="account">
        <label for="display-name">Display name</label>
        <input id="display-name" name="displayName" required />
        <button type="submit">Save</button>
      </form>
    </>
  )
}
```

Native constraint validation and submitter overrides still apply. GET form values arrive in `src`; non-GET forms provide `formData`, `method`, and `encType` to the resolver. See [Frames](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#form-navigation) for targeting, history behavior, request encoding, opt-outs, and server response guidance.

Reload another source or send a request body without changing browser history:

```tsx
await handle.frame.reload({ src: '/account/edit' })

let body = new FormData()
body.set('displayName', 'Ada')
await handle.frame.reload({
  src: '/account/edit',
  method: 'post',
  body,
})
```

`src` becomes the source for subsequent reloads. Pass `FormData` as `body` to submit fields. The method defaults to GET, which encodes the fields into the source query. POST defaults to `application/x-www-form-urlencoded`; use `encType` to select `multipart/form-data` or `text/plain`. Methods and encodings are case-insensitive; unsupported values use the defaults. See [Reload requests](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#reload-requests) for request and cancellation behavior.

Use `data-rmx-history="push|replace"` on an enhanced anchor or form to control how the navigation updates history. This can override the automatic replacement used for non-GET form submissions to the current URL.

Add `data-rmx-prefetch="intent"` to a link to start loading its page when the visitor hovers, focuses, or presses it. Use `data-rmx-prefetch="viewport"` to start loading when the link enters the viewport. Remix fetches its HTML to discover JavaScript, CSS, and explicit image and font preloads for asset prefetch hints. Navigation uses the default resolver and browser HTTP cache; even uncacheable HTML can reveal cacheable assets. See [Prefetching](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#prefetching) for trigger details, caching behavior, and custom strategies.

Named-frame links with `data-rmx-target` are supported, including `data-rmx-src` overrides. Prefetching uses the selected frame's source and sends its target, matching the eventual frame request.

Automatic link prefetching is skipped when the browser reports Save-Data or an effective connection type of `slow-2g` or `2g`. Imperative `prefetch()` calls remain available regardless of these settings.

You can implement other prefetch triggers in userland with the imperative `prefetch()` API from `remix/component`, such as prefetching a search result as the visitor types. Call `prefetch(src, { target: 'details' })` to prefetch content for a named frame.

## Single-page Applications

Use `render` and `run` from `remix/spa` when every route runs in the browser and returns a component
tree instead of an HTTP response body. The render middleware keeps the router's standard `Request`
to `Response` contract while associating the response with a node for the top frame to render:

```tsx
import { createRouter } from 'remix/router'
import { render, run } from 'remix/spa'

let router = createRouter({ middleware: [render()] })

router.get('/', ({ render }) => render(<h1>Home</h1>))
router.get('/about', ({ render }) => render(<h1>About</h1>))

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

Use `data-rmx-preserve-dom` on the smallest element whose live DOM should belong to client code after initial render, such as a custom element or third-party widget:

```tsx
<pagefind-ui data-rmx-key="search" data-rmx-preserve-dom>
  <button type="button">Search</button>
</pagefind-ui>
```

The component runtime still renders the element's children during SSR and still hydrates any initial client entries inside it. On later frame reloads, matched `data-rmx-preserve-dom` elements keep their current attributes and children instead of accepting incoming DOM updates. See [Preserving client-owned DOM](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#preserving-client-owned-dom) for guidance and caveats.

Use `data-rmx-preserve-attrs` when client code owns only specific attributes, such as a theme set on `<html>`:

```html
<html lang="en" data-rmx-preserve-attrs="data-theme"></html>
```

On frame reloads, the space-separated attribute names in the incoming HTML keep their live values or absence. Other attributes and children reconcile normally. An empty or omitted list uses normal attribute reconciliation. This works on any matched element; it does not prevent removal or replacement. See [Preserving client-owned attributes](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#preserving-client-owned-attributes) for examples and ownership rules.

## Raw HTML with unsafeHTML

Host raw-HTML props (`innerHTML` and iframe `srcDoc` / `srcdoc`) require an explicit value created with `unsafeHTML(...)`:

```tsx
import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'

function ArticleBody(handle: Handle<{ html: string }>) {
  return () => <article innerHTML={unsafeHTML(handle.props.html)} />
}
```

When `innerHTML` is set, the element's `children` are ignored. `unsafeHTML()` is an authorization boundary and does not sanitize input; only pass trusted or already-sanitized HTML.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
