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

In a Remix app, install `render()` once. It resolves nested and targeted frames through the current router, carries request credentials and top-frame state, follows redirects, and preserves non-successful response content:

```tsx
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

let router = createRouter({ middleware: [render()] })

router.get('/', (context) => context.render(<App />))
router.get('/recommendations', (context) => context.render(<Recommendations />))
```

For a fully custom rendering pipeline, `renderToStream({ resolveFrame })` accepts frame content as:

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

Add `data-rmx-preserve-dom` to an element when its live DOM should be owned by client code after the element has been matched during a frame reload:

```tsx
function SearchWidget() {
  return () => (
    <pagefind-ui data-rmx-key="search" data-rmx-preserve-dom>
      <button type="button">Search</button>
    </pagefind-ui>
  )
}
```

During server rendering and streaming, Remix UI still renders the element's attributes and children. During initial client boot, hydration still discovers and hydrates client entries inside the element. The attribute only affects later frame reconciliation: when incoming frame HTML contains `data-rmx-preserve-dom` on a matched element, Remix UI preserves the current element attributes and children instead of applying incoming DOM changes below that element.

Use this for custom elements, third-party widgets, and imperative integrations that take ownership of their own subtree after initial render. Keep the preserved boundary as small as possible, and add `data-rmx-key` when the element can move among siblings so reloads can match the same live element before falling back to index-based matching.

Avoid wrapping Remix-owned UI that should continue receiving server-driven frame updates. A client entry inside `data-rmx-preserve-dom` can hydrate from the initial HTML, but later frame reloads will not patch new server-rendered children or props through the preserved host. Put the client entry outside the preserved boundary when it needs future frame data, or put `data-rmx-preserve-dom` inside the client entry around only the imperative DOM island.

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

On the client, `run` fetches frame sources by default. The built-in resolver is equivalent to:

```js
async function resolveFrame(src, options) {
  let response = await fetch(src, {
    body: getRequestBody(options),
    headers: { Accept: 'text/html' },
    method: options?.method,
    signal: options?.signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
  }

  return response
}

function getRequestBody(options) {
  let formData = options?.formData
  if (!formData || options?.method?.toLowerCase() === 'get') return

  if (options?.encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return new Blob([body], { type: 'text/plain' })
  }

  if (options?.encType !== 'application/x-www-form-urlencoded') return formData

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}

function normalizeLineBreaks(value) {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}
```

This requests HTML and is used for initial hydration of pending frames, `handle.frame.reload()`
calls, link navigations, and form navigations. GET form values are already encoded in `src`; non-GET
submissions use `URLSearchParams` for `application/x-www-form-urlencoded`, CRLF-delimited text for
`text/plain`, and `FormData` for `multipart/form-data`. Provide `resolveFrame` when an app needs
additional headers, another body encoding, or a different response policy. Custom resolvers receive
`signal` and `target`; non-GET form submissions also provide `formData`, `method`, and `encType`.

The default resolver rejects non-OK responses. A custom resolver may return a `Response` with any
status when it wants Remix UI to render the response body.

A client resolver may return frame content directly or return the fetched `Response`. Returning the response lets Remix stream its body. When `fetch()` followed a redirect during a top-frame navigation, the final response URL replaces the browser navigation URL and becomes the top frame's canonical `src`; other frames render the response without changing either URL.

Because this function defines the trust boundary for frame HTML, only return content from sources you trust.

## Link navigation

Eligible same-origin anchor navigations reload `handle.frames.top` through the frame resolver instead of performing a full document navigation.

- `data-rmx-target="name"` reloads a named frame.
- `data-rmx-src="/frame"` overrides the URL resolved into that frame while `href` remains the navigation destination.
- `data-rmx-history="push|replace"` controls how the navigation updates history.
- `data-rmx-reset-scroll="false"` preserves the current scroll position.
- `data-rmx-document` leaves the link as a normal document navigation.

The `link(href, { history })` mixin adds the corresponding `data-rmx-history` value when its host is a native anchor. Download links, cross-origin links, and links marked with `data-rmx-document` are left to the browser.

## Form navigation

Eligible same-origin form submissions use the same frame navigation path as links. Native constraint validation and the form's `submit` event run first, so invalid forms never reach `resolveFrame`.

- Submissions reload `handle.frames.top` by default.
- `data-rmx-target="name"` reloads a named frame.
- `data-rmx-src="/frame"` overrides the URL resolved into that frame while the form action remains the navigation destination.
- `data-rmx-history="push|replace"` overrides how the navigation updates history.
- `data-rmx-reset-scroll="false"` preserves the current scroll position.
- `data-rmx-document` leaves the submission as a normal document navigation.
- Submitter overrides such as `formmethod`, `formenctype`, and `formtarget` take precedence over the form attributes.
- Cross-origin submissions, `method="dialog"`, and `target="_blank"` are left to the browser.

GET forms behave like links: the browser includes their successful controls in the destination URL, and the resolver receives that URL as `src` without separate submission metadata. For non-GET submissions, the default resolver uses `URLSearchParams` for `application/x-www-form-urlencoded`, CRLF-delimited text for `text/plain`, and `FormData` for `multipart/form-data`. A custom resolver may use `method` and `encType` to apply another encoding policy.

For example, this form works as a normal document POST without JavaScript and reloads the named frame after `run()` starts:

```tsx
<Frame name="account" src="/account/edit" />

<form action="/account/edit" method="post" data-rmx-target="account">
  <label for="display-name">Display name</label>
  <input id="display-name" name="displayName" required />
  <button type="submit">Save</button>
</form>
```

The action should return HTML suitable for the targeted frame while retaining its normal document response or redirect for unenhanced submissions. Apps that distinguish frame requests with custom headers can provide a resolver that adds them.

Enhanced non-GET submissions to the current URL replace its navigation history entry instead of pushing a duplicate. Submissions to a different URL push a new entry, as do GET submissions whose values are represented in the destination URL. The `data-rmx-history` attribute overrides that default: use `data-rmx-history="replace"` to force replacement or `data-rmx-history="push"` to force a push. Non-GET `FormData` is used only for the active frame reload and is not retained in history.

Forms work as normal document submissions before the client runtime loads and whenever they use `data-rmx-document`, so this behavior remains progressively enhanced. Browsers ignore `data-rmx-history` without the client runtime and use their normal document history behavior.

## Frame lifecycle

1. **Server render** - Frame content is resolved via `resolveFrame` and serialized into the HTML stream. Frame metadata is stored in the `rmx-data` script.
2. **Client boot** - `run` discovers frame boundaries, hydrates client entries inside them, and sets up observers for any pending (non-blocking) frames still streaming.
3. **Reload** - `handle.frame.reload()` re-fetches the frame's `src`, diffs the new content into the DOM, and re-hydrates any client entries with updated props.
4. **Dispose** - When a frame is removed (e.g., parent re-render), its client entries are cleaned up and sub-frames are disposed recursively.

## See Also

- [Server](../src/server/README.md) - Streaming HTML with `renderToStream`
- [Hydration](./hydration.md) - Client entries and the `run` function
