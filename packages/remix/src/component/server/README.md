# Server

The component runtime can render to HTML on the server using two APIs:

- `renderToString` - Returns a complete HTML string. Simple, but buffers the entire response.
- `renderToStream` - Returns a `ReadableStream<Uint8Array>`. Sends the initial HTML immediately and streams frame content as it resolves.

Both are exported from `remix/component/server`.

## renderToString

Renders a component tree to a complete HTML string. Use this when you need the full output before responding (e.g., generating static pages or embedding HTML in an email).

```tsx
import { renderToString } from 'remix/component/server'

let html = await renderToString(<App />)
```

Pass `nonce` when rendering under a [Content Security Policy](#content-security-policy). Render errors reject the returned promise.

```tsx
let nonce = crypto.getRandomValues(new Uint8Array(16)).toBase64()
let html = await renderToString(<App />, { nonce })
```

## renderToStream

Renders a component tree to a streaming response. The initial HTML is sent immediately. Any `<Frame>` components with a `fallback` prop will render the fallback first, then stream the resolved content as it becomes available.

```tsx
import { renderToStream } from 'remix/component/server'
import { assetServer } from './assets.ts'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  signal: request.signal,
  resolveFrame(src, _target, context) {
    let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url)
    return fetchHtml(frameUrl)
  },
  async resolveClientEntry(entryId, component) {
    let { href, importMap, preloads } = await assetServer.getScriptEntry(entryId)
    return {
      href,
      importMap,
      exportName: entryId.split('#')[1] || component.name,
      preloads,
    }
  },
  onError(error) {
    console.error(error)
  },
})

return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})
```

### Options

- **`frameSrc`** - Seeds SSR frame state for the current render. When provided, server-rendered components can read `handle.frame.src` and `handle.frames.top.src` during SSR.
- **`topFrameSrc`** - Overrides the root frame URL used for `handle.frames.top.src`. This is mainly useful when calling `renderToStream()` from inside `resolveFrame()` for a nested frame render.
- **`signal`** - Cancels pending server rendering work. Pass `request.signal` so client disconnects can stop unresolved frame work without invoking `onError` for the disconnect itself.
- **`resolveFrame(src, target, context)`** - Called when a `<Frame>` needs its content. Return a string of HTML, a `ReadableStream<Uint8Array>`, or a promise of either. `context.currentFrameSrc` is the URL for the frame that contains the `<Frame>`, and `context.topFrameSrc` is the outer document URL. `context.nonce` carries the enclosing render's nonce for nested renders. Required if your component tree contains `<Frame>` elements.
- **`resolveClientEntry(entryId, component)`** - Resolves the public module URL, export name, optional import map, and optional module preload hrefs for a hydrated client entry.
- **`onError(error)`** - Receives rendering errors and defaults to logging them. Fatal errors reject the stream even when a handler is supplied.
- **`nonce`** - CSP nonce for generated import maps, module preloads, and CSS mixin styles. Use a fresh, unpredictable value for each document response and the same value in its policy.

### Content Security Policy

The renderer stamps generated resources, including module preloads hoisted from blocking frames. Supply nonce attributes on authored scripts, styles, and links when your policy requires them. An explicit `<ImportMap nonce="...">` keeps its own value. The `#rmx-data` JSON data block needs no nonce because it is never executed.

For automatic policy headers and nonce propagation, use [CSP middleware](../../csp-middleware/README.md). With custom server resolvers, forward `context.nonce` to nested renders so embedded styles match the document's policy. Carry `topFrameSrc` forward to preserve `handle.frames.top.src`:

```tsx
let stream = renderToStream(<App />, {
  frameSrc: request.url,
  nonce,
  resolveFrame(src, _target, context) {
    let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url)
    return renderToStream(<FrameContent url={frameUrl} />, {
      frameSrc: frameUrl,
      topFrameSrc: context?.topFrameSrc,
      nonce: context?.nonce,
    })
  },
})
```

Server resolvers that fetch HTML must arrange for the remote renderer to use the enclosing nonce; server rendering does not rewrite returned frame HTML.

#### Client navigation

Client navigation and frame reloads keep the original document's CSP. The runtime retains its render nonce in `<meta name="rmx-nonce" nonce="...">`. Later import maps and module preloads use the initial managed import map's nonce, falling back to that metadata.

For other nonce-bearing styles, scripts, and links, the runtime rewrites matching response nonces to the document render nonce before insertion, including streamed templates. The destination nonce comes only from the initial document's nonce metadata; an authored import-map nonce alone does not enable rewriting. Rewriting requires one distinct nonce across the response's enforcing CSP script and style source lists, including directive fallbacks. Multiple distinct nonces, report-only headers, and incoming HTML metadata cannot authorize rewriting; elements with missing or different nonces stay unchanged. This supports the single shared nonce generated by `csp()`, rather than arbitrary multi-nonce policies.

Custom browser resolvers must return a trusted `Response` with its `Content-Security-Policy` header intact to enable rewriting. Returning only HTML or a body stream loses the response nonce. The fetched header identifies that nonce; it does not replace the active document's policy or change whether inserted scripts execute.

Document navigation parses HTML in a detached element so styles do not produce premature CSP reports. Scripts remain inert, and frame navigation discards `<noscript>` fallback content because scripting is enabled.

### Streaming behavior

When the stream encounters a `<Frame>` component:

- **Without `fallback`** (blocking): The frame content is awaited before the initial HTML chunk is sent. The resolved content appears inline.
- **With `fallback`** (non-blocking): The fallback is rendered inline in the initial chunk. Once the frame resolves, a `<template>` element containing the real content is streamed at the end of the response. The client swaps it in automatically.

This means the first chunk always contains a complete, renderable page. Slow data sources don't block the initial paint.

## Head content

To render content into the document head during SSR, use an explicit `<head>` element:

```tsx
function ProductPage() {
  return () => (
    <html>
      <head>
        <title>Product Name</title>
        <meta name="description" content="A great product" />
      </head>
      <body>
        <h1>Product Name</h1>
      </body>
    </html>
  )
}
```

## CSS

Components using the `css(...)` mixin through `mix` have their styles collected during rendering and emitted as a single `<style>` tag in the `<head>`. No client-side style injection is needed for server-rendered content.

### Import maps

Use `<ImportMap>` when the document needs one initial import map containing both authored mappings and mappings from blocking client entries. The server merges these mappings into the component before sending the initial HTML.

Regular `<script type="importmap">` elements remain supported. The server leaves them unchanged and emits any additional client entry mappings separately, omitting entries already present in authored maps.

```tsx
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

function Document(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <html>
      <head>
        <ImportMap value={scriptEntry.importMap} />
      </head>
      <body>{handle.props.children}</body>
    </html>
  )
}
```

## See Also

- [Hydration](https://github.com/remix-run/remix/blob/main/packages/component/docs/hydration.md) - Making server-rendered components interactive on the client
- [Frames](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md) - Streaming partial server UI with `<Frame>`
