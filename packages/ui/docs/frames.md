# Frames

A `<Frame>` renders server content into the page. Frames can stream in after the initial HTML, nest inside other frames, contain client entries, and be reloaded from the client without a full page navigation.

## Basic usage

```tsx
import { Frame } from 'remix/ui'

function App() {
  return () => (
    <div>
      <h1>Dashboard</h1>
      <Frame src="/sidebar" fallback={<div>Loading sidebar...</div>} />
      <Frame src="/main-content" />
    </div>
  )
}
```

### Props

- **`src`** (required) - The URL to fetch the frame content from.
- **`fallback`** (optional) - Content to show while the frame is loading. When provided, the frame streams non-blocking (the initial page renders immediately with the fallback, and the real content arrives later). Without a fallback, the frame blocks rendering until its content resolves.
- **`name`** (optional) - Registers the frame for lookup via `handle.frames.get(name)` from client entries.

## Blocking vs non-blocking

The presence of a `fallback` prop determines streaming behavior:

**Blocking** (no fallback): The server waits for the frame content before sending the initial HTML chunk. Use this for content that must be visible immediately.

```tsx
<Frame src="/critical-header" />
```

**Non-blocking** (with fallback): The fallback renders in the initial chunk. The real content streams in later and replaces the fallback. Use this for content that can load progressively.

```tsx
<Frame src="/recommendations" fallback={<div>Loading...</div>} />
```

## Resolving frame content

On the server, `renderToStream` calls your `resolveFrame` function to get the HTML for each frame:

```tsx
import { renderToStream } from 'remix/ui/server'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  async resolveFrame(src, _target, context) {
    let res = await fetch(new URL(src, context?.currentFrameSrc ?? request.url))
    return res.body // or res.text() for a string
  },
})
```

`resolveFrame` can return:

- A string of HTML
- A `ReadableStream<Uint8Array>`
- A promise of either

Frame content is itself rendered with `renderToStream`, so frames can contain other frames and client entries. The hydration data from nested frames is merged into the parent response automatically.

When a server frame response is itself rendered with `renderToStream()`, pass `frameSrc` for that frame's URL and forward `topFrameSrc` from `resolveFrame()` if you want nested SSR components to keep seeing the outer document URL through `handle.frames.top.src`.

## Reloading frames

Client entries inside a frame can trigger a reload via `handle.frame.reload()`:

```tsx
import { clientEntry, on, type Handle } from 'remix/ui'

export let RefreshButton = clientEntry(
  '/assets/refresh.js#RefreshButton',
  function RefreshButton(handle: Handle) {
    return () => (
      <button
        mix={[
          on('click', () => {
            handle.frame.reload()
          }),
        ]}
      >
        Refresh
      </button>
    )
  },
)
```

You can also reload adjacent named frames:

```tsx
<Frame name="cart-summary" src="/cart-summary" />
<Frame name="cart-empty" src="/cart-empty" />
<Frame src="/cart-row" />
```

```tsx
function CartRow(handle: Handle) {
  return () => (
    <button
      mix={[
        on('click', async () => {
          await handle.frames.get('cart-summary')?.reload()
          await handle.frames.get('cart-empty')?.reload()
          await handle.frame.reload()
        }),
      ]}
    >
      Save
    </button>
  )
}
```

`handle.frames.get(name)` returns `undefined` when no named frame is mounted.

When a frame reloads:

1. The frame's `src` is re-fetched via `resolveFrame` on the client.
2. The new HTML is parsed and diffed against the current frame content.
3. Matching DOM nodes are updated in place. New nodes are inserted, removed nodes are cleaned up.
4. Client entries inside the frame receive updated props from the server while preserving their local component state.

This means a counter inside a reloading frame keeps its count, but sees any new props the server sends.

## Preserving client-owned DOM

Add `rmx-preserve-dom` to an element when its live DOM should be owned by client code after the element has been matched during a frame reload:

```tsx
function SearchWidget() {
  return () => (
    <pagefind-ui data-key="search" rmx-preserve-dom>
      <button type="button">Search</button>
    </pagefind-ui>
  )
}
```

During server rendering and streaming, Remix UI still renders the element's attributes and children. During initial client boot, hydration still discovers and hydrates client entries inside the element. The attribute only affects later frame reconciliation: when incoming frame HTML contains `rmx-preserve-dom` on a matched element, Remix UI preserves the current element attributes and children instead of applying incoming DOM changes below that element.

Use this for custom elements, third-party widgets, and imperative integrations that take ownership of their own subtree after initial render. Keep the preserved boundary as small as possible, and add `data-key` when the element can move among siblings so reloads can match the same live element before falling back to index-based matching.

Avoid wrapping Remix-owned UI that should continue receiving server-driven frame updates. A client entry inside `rmx-preserve-dom` can hydrate from the initial HTML, but later frame reloads will not patch new server-rendered children or props through the preserved host. Put the client entry outside the preserved boundary when it needs future frame data, or put `rmx-preserve-dom` inside the client entry around only the imperative DOM island.

## Nested frames

Frames can nest. Each frame owns its own region of the DOM and hydrates its client entries independently:

```tsx
function App() {
  return () => (
    <div>
      <Frame src="/outer" fallback={<div>Loading outer...</div>} />
    </div>
  )
}

// /outer response:
function OuterFrame() {
  return () => (
    <div>
      <h2>Outer</h2>
      <Frame src="/inner" fallback={<div>Loading inner...</div>} />
    </div>
  )
}
```

Nested frames stream independently. The outer frame can resolve and render while the inner frame is still loading.

During SSR, `handle.frame.src` should point at the frame currently being rendered, while `handle.frames.top.src` should stay fixed at the outer document URL. Use `renderToStream({ frameSrc, topFrameSrc })` inside nested `resolveFrame()` handlers to preserve that distinction.

## Client-resolved frames

On the client, `run` accepts an optional `resolveFrame` implementation:

```tsx
let app = run({
  loadModule: ...,
  async resolveFrame(src, options) {
    let headers = new Headers({ Accept: 'text/html' })
    if (options?.target) headers.set('X-Remix-Target', options.target)
    let response = await fetch(src, {
      headers,
      method: options?.method,
      body: options?.method?.toLowerCase() === 'post' ? options.formData : undefined,
      signal: options?.signal,
    })
    return response.body ?? (await response.text())
  },
})
```

This is used both for initial hydration of pending frames and for `handle.frame.reload()` calls. `options` may contain `formData`, `method`, `encType`, `signal`, and `target`. The runtime reports the form's selected transport metadata but does not encode the body or interpret fields such as `_method`; the resolver owns that policy. Return `response.body` to preserve streaming frame responses.

If omitted, frames resolve to `<p>resolve frame unimplemented</p>` and document navigations are left to the browser. Because this function defines the trust boundary for frame HTML, only return content from sources you trust.

## Form navigation

When `run({ resolveFrame })` is active, eligible same-origin form submissions use the same frame navigation path as links. Native constraint validation and the form's `submit` event run first, so invalid forms never reach `resolveFrame`.

- Submissions reload `handle.frames.top` by default.
- `rmx-target="name"` reloads a named frame.
- `rmx-document` leaves the submission as a normal document navigation.
- Submitter overrides such as `formmethod`, `formenctype`, and `formtarget` take precedence over the form attributes.
- Cross-origin submissions, `method="dialog"`, and `target="_blank"` are left to the browser.

The browser already includes GET form values in `src`; the runtime also forwards the browser's native form entry list as `formData`. For other methods, use `formData`, `method`, and `encType` to choose the request body in your resolver. For example, a resolver may send `FormData` directly for `multipart/form-data`, convert it to `URLSearchParams` for `application/x-www-form-urlencoded`, or apply an application-specific encoding policy.

Enhanced non-GET submissions replace the current navigation history entry instead of pushing a new one. Their `FormData` is used only for the active frame reload and is not retained in history. GET submissions continue to push entries because their values are represented in the destination URL.

Forms work as normal document submissions before the client runtime loads and whenever they use `rmx-document`, so this behavior remains progressively enhanced.

## Frame lifecycle

1. **Server render** - Frame content is resolved via `resolveFrame` and serialized into the HTML stream. Frame metadata is stored in the `rmx-data` script.
2. **Client boot** - `run` discovers frame boundaries, hydrates client entries inside them, and sets up observers for any pending (non-blocking) frames still streaming.
3. **Reload** - `handle.frame.reload()` re-fetches the frame's `src`, diffs the new content into the DOM, and re-hydrates any client entries with updated props.
4. **Dispose** - When a frame is removed (e.g., parent re-render), its client entries are cleaned up and sub-frames are disposed recursively.

## See Also

- [Server](../src/server/README.md) - Streaming HTML with `renderToStream`
- [Hydration](./hydration.md) - Client entries and the `run` function
