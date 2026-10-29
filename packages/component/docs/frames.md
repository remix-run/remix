# Frames

## Resolving frame content

Frame content is itself rendered with `renderToStream`, so frames can contain other frames and client entries. The hydration data from nested frames is merged into the parent response automatically.

## Preserving client-owned DOM

The `data-rmx-preserve-dom` attribute only affects later frame reconciliation: when incoming frame HTML contains `data-rmx-preserve-dom` on a matched element, the component runtime preserves the current element attributes and children instead of applying incoming DOM changes below that element.

Add `data-rmx-key` when the element can move among siblings so reloads can match the same live element before falling back to index-based matching.

Avoid wrapping Remix-owned UI that should continue receiving server-driven frame updates. A client entry inside `data-rmx-preserve-dom` can hydrate from the initial HTML, but later frame reloads will not patch new server-rendered children or props through the preserved host. Put the client entry outside the preserved boundary when it needs future frame data, or put `data-rmx-preserve-dom` inside the client entry around only the imperative DOM island.

## Preserving client-owned attributes

Each attribute listed in `data-rmx-preserve-attrs` is preserved as a whole, so listing `class` preserves all its tokens without merging server classes.

Removing a name from the incoming list immediately returns that attribute to normal reconciliation.

This does not preserve descendants. Initial rendering and hydration are unchanged.

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

## Client-resolved frames

A normal browser document load does not use the resolver and does not send the `X-Remix-Frame` or `X-Remix-Target` headers. Top-frame and unnamed frame requests have the same headers; give a frame a name when the handler needs to distinguish it. The handler decides whether to return a full document or a fragment.

Same-origin subrequests created by a `render()` middleware render carry its top-frame source to nested renders. If frame content depends on the containing page, include the relevant context explicitly in the frame's `src`.

The resolver is used for `<Frame>` elements first rendered in the browser, `handle.frame.reload()` calls, link navigations, and form navigations. Pending frames from the server response are filled in by the streamed HTML, not the resolver.

A client resolver may return frame content directly or return the fetched `Response`. Returning the
response lets Remix stream its body. When `fetch()` followed a redirect, frames other than the top
frame render the response without changing either URL.

With the default resolver's `same-origin` Fetch mode, cross-origin sources and redirects fail, even if the destination allows CORS.

## Link navigation

Every source override must resolve to the document origin, using `document.baseURI` for relative URLs.

## Form navigation

- Submitter overrides such as `formmethod`, `formenctype`, and `formtarget` take precedence over the form attributes.
- Cross-origin submissions, `method="dialog"`, and `target="_blank"` are left to the browser.

Non-GET `FormData` is used only for the active frame reload and is not retained in history.

Browsers ignore `data-rmx-history` without the client runtime and use their normal document history behavior.

### Reload requests

Reloads make one resolver request.

For GET reloads, the fields replace the source's query. Repeated fields and the URL fragment are preserved, and the resulting URL becomes the source for subsequent reloads.

For POST, `multipart/form-data` lets Fetch generate the boundary. URL-encoded and plain-text submissions use file names in place of file contents and normalize line breaks to CRLF.

Omitted `body` means no request body, including on subsequent reloads after a POST.

For a POST form, construct form data explicitly from the form element. Reloads do not perform constraint validation or dispatch a submit event:

```tsx
if (form.reportValidity()) {
  await handle.frame.reload({
    src: form.action,
    method: form.method,
    encType: form.enctype,
    body: new FormData(form, saveButton),
  })
}
```

Custom resolvers receive the requested `src`, `method`, and `signal`. GET form values are already encoded in `src`, with `formData` and `encType` omitted. POST reloads provide `formData` and a normalized `encType`, using the same resolver options as navigation form submissions; the resolver applies that encoding. Redirect responses render their final content without changing the frame's requested source or the browser URL.

A newer reload cancels earlier client work for that frame, including pending requests and streamed content. Cancelling client work cannot undo a mutation the server has already performed.

## Prefetching

Intent prefetching starts when the visitor rests the mouse or keyboard focus on the link for 100ms, or presses it.

Links with `data-rmx-document`, `download`, or a `target` other than `_self` are skipped. Both the navigation destination and any `data-rmx-src` override must resolve to the document origin.

The `navigator.connection` check runs when a trigger fires; it does not cancel prefetches already in progress. Browsers without this API retain normal prefetching.

For named-frame links, missing named frames are skipped. Without a nonempty target, a valid `data-rmx-src` is ignored and `href` is prefetched.

Hover and focus are tracked independently. Moving between children of a link, pressing it after its prefetch starts, or focusing it while it is hovered does not repeat the prefetch. Leaving the link with both the pointer and focus ends that interaction; returning can prefetch again. A press starts prefetching immediately if the interaction has not triggered yet, including touch and pen presses.

Viewport links prefetch once while mounted with the same normalized frame source and target. Leaving and reentering the viewport, hovering, focusing, or pressing them does not repeat the prefetch. Changing the requested source or target makes a link eligible again; changing only a fragment, or changing `href` while a named frame's source override stays the same, does not. Removing and later mounting a link also makes it eligible again. Remix uses one `IntersectionObserver` and one `MutationObserver` to track initial links and links added or changed by streaming, frame navigation, or client rendering. Runtime disposal disconnects both observers. Browsers without `IntersectionObserver` skip viewport prefetching while retaining intent and imperative prefetching.

By default, Remix fetches the frame source with GET, a `priority: 'low'` hint, and the same `Accept: text/html` and `X-Remix-Frame: true` headers as a frame navigation, plus `X-Remix-Target` for named frames. It reads the response into an inert template and discovers explicit JavaScript and CSS URLs and `<link rel="preload" as="image|font" href="…">` declarations, including resources inside nested frame templates. It adds ordinary `<link rel="prefetch" as="script|style|image|font">` hints for assets that are not already active in the document. These hints do not run scripts, apply styles, install import maps, or follow module dependencies. They remain connected through frame navigation and are removed on load, error, or runtime disposal.

Declare important destination images and fonts with preload links to include them in discovery:

```html
<link rel="preload" as="image" href="/images/product-hero.jpg" />
<link rel="preload" as="font" href="/fonts/body.woff2" type="font/woff2" crossorigin />
```

Image and font preload links must have an explicit `href` and a matching `media` condition, if specified. Include `crossorigin` on font preloads, even for same-origin URLs, to match CSS font requests. Remix preserves that setting on the prefetch hint. It skips image declarations with `imagesrcset` because ordinary prefetch hints cannot select a responsive image candidate. It does not scan `<img>` elements or parse CSS `@font-face` rules.

The consumed HTML is discarded. Navigation uses the normal frame resolver and browser HTTP cache: matching fresh responses can be reused, `no-cache` responses revalidate, and `no-store` responses are fetched again. Asset discovery still works for `no-store` HTML because assets have their own cache policies. No special HTML cache headers are required to discover assets; reusing responses requires appropriate HTTP caching headers, such as `Cache-Control: private, max-age=30`, and matching request variants selected by `Vary`.

Remix deduplicates pending HTML discovery by source and target, and asset hints across frame requests, but keeps no completed response cache. Servers that return different HTML for different frame targets should include `X-Remix-Target` in `Vary` when making those responses cacheable. An early navigation starts its normal fetch independently of discovery; request sharing is up to the browser. Asset prefetches are hints and may be deferred or ignored. Browsers without link-prefetch support skip asset hints while still fetching HTML. Discovery waits for the full HTML body and does not traverse JavaScript imports, CSS imports, or CSS images and fonts.

To reuse uncacheable HTML in memory, pass `prefetch` and `resolveFrame` to `run()`. Remix still decides when and which links to prefetch. This example holds each prefetched response for the next GET request with the same source and target. The app provides `fetchFrame(src, options)` to handle frame headers, submissions, cancellation, and response handling. Applications also own the lifetime and invalidation of any responses they retain:

```ts
import { run } from 'remix/component'

let prefetched = new Map<string, Promise<Response>>()

function frameKey(src: string, target?: string) {
  let url = new URL(src, document.baseURI)
  url.hash = ''
  return JSON.stringify([url.href, target])
}

run({
  loadModule,
  prefetch(src, options) {
    prefetched.set(frameKey(src, options?.target), fetchFrame(src, options))
  },
  resolveFrame(src, options) {
    let isGet = !options?.method || options.method.toUpperCase() === 'GET'
    let response = isGet ? prefetched.get(frameKey(src, options?.target)) : undefined
    prefetched.clear()
    return response ?? fetchFrame(src, options)
  },
})
```

## Frame lifecycle

1. **Server render** - Frame content is resolved via `resolveFrame` and serialized into the HTML stream. Frame metadata is stored in the `rmx-data` script.
2. **Client boot** - `run` discovers frame boundaries, hydrates client entries inside them, and sets up observers for any pending (non-blocking) frames still streaming.
3. **Reload** - `handle.frame.reload()` re-fetches the frame's `src`, diffs the new content into the DOM, and re-hydrates any client entries with updated props.
4. **Dispose** - When a frame is removed (e.g., parent re-render), its client entries are cleaned up and sub-frames are disposed recursively.
