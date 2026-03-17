# Frames

A `<Frame>` renders server content into the page. Frames can stream in after the initial HTML, nest inside other frames, contain client entries, and be reloaded from the client without a full page navigation.

## Basic usage

```tsx
import { Frame } from 'remix/component'

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
import { renderToStream } from 'remix/component/server'

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
import { clientEntry, on, type Handle } from 'remix/component'

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
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ accept: 'text/html' })
    if (target) headers.set('x-remix-target', target)
    let response = await fetch(src, { headers, signal })
    return response.body ?? (await response.text())
  },
})
```

This is used both for initial hydration of pending frames and for `handle.frame.reload()` calls. If omitted, frames resolve to `<p>resolve frame unimplemented</p>`. Because this function defines the trust boundary for frame HTML, only return content from sources you trust.

## Frame lifecycle

1. **Server render** - Frame content is resolved via `resolveFrame` and serialized into the HTML stream. Frame metadata is stored in the `rmx-data` script.
2. **Client boot** - `run` discovers frame boundaries, hydrates client entries inside them, and sets up observers for any pending (non-blocking) frames still streaming.
3. **Reload** - `handle.frame.reload()` re-fetches the frame's `src`, diffs the new content into the DOM, and re-hydrates any client entries with updated props.
4. **Dispose** - When a frame is removed (e.g., parent re-render), its client entries are cleaned up and sub-frames are disposed recursively.

## See Also

- [Server Rendering](./server-rendering.md) - Streaming HTML with `renderToStream`
- [Hydration](./hydration.md) - Client entries and the `run` function
