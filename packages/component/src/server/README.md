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

Renders a component tree to a streaming response. The initial HTML is sent immediately. Eager `<Frame>` components with a `fallback` prop render the fallback first, then stream the resolved content as it becomes available. Lazy frames render only their fallback and load later in the browser.

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
- **`resolveFrame(src, target, context)`** - Called when an eager `<Frame>` needs its content. Return a string of HTML, a `ReadableStream<Uint8Array>`, or a promise of either. `context.currentFrameSrc` is the URL for the frame that contains the `<Frame>`, and `context.topFrameSrc` is the outer document URL. `context.nonce` carries the enclosing render's nonce for nested renders. Required if your component tree contains eager `<Frame>` elements.
- **`resolveClientEntry(entryId, component)`** - Resolves the public module URL, export name, optional import map, and optional module preload hrefs for a hydrated client entry.
- **`onError(error)`** - Receives rendering errors and defaults to logging them. Fatal errors reject the stream even when a handler is supplied.
- **`nonce`** - CSP nonce for generated import maps, module preloads, and CSS mixin styles. Use a fresh, unpredictable value for each document response and the same value in its policy.

### Content Security Policy

Generated resources use `nonce`; authored scripts, styles, and links need nonce attributes when your policy requires them. An explicit `<ImportMap nonce="...">` keeps its own value. For automatic policy headers and nonce propagation, use [CSP middleware](https://github.com/remix-run/remix/tree/main/packages/csp-middleware).

For custom server resolvers, forward `resolverContext.nonce` and `resolverContext.topFrameSrc` to nested renders:

```tsx
let stream = renderToStream(<App />, {
  frameSrc: request.url,
  nonce,
  resolveFrame(src, _target, resolverContext) {
    let frameUrl = new URL(src, resolverContext?.currentFrameSrc ?? request.url)
    return renderToStream(<FrameContent url={frameUrl} />, {
      frameSrc: frameUrl,
      topFrameSrc: resolverContext?.topFrameSrc,
      nonce: resolverContext?.nonce,
    })
  },
})
```

Blocking frames' managed import maps and module preloads are hoisted and stamped with the enclosing nonce. The remaining frame HTML must already satisfy the enclosing policy. Fetch it only from trusted renderers using the enclosing nonce.

Navigation keeps the original document's CSP and nonce across frame and island updates. Custom browser resolvers must return a trusted `Response` with CSP headers intact; returning only HTML or a stream loses its nonce.

When the initial document was rendered with `nonce` and a response's CSP identifies one shared nonce for scripts and styles, matching resource nonces are translated to the document nonce. Missing or different nonces stay unchanged. The runtime uses `Content-Security-Policy-Report-Only` only when `Content-Security-Policy` is absent.

### Streaming behavior

When the stream encounters a `<Frame>` component:

- **With `loading="lazy"`**: Only the fallback and frame metadata are rendered. The server does not resolve the source or stream a content template. To defer browser loading, provide a fallback that renders an element. After `run()` starts in the browser, the frame loads through the browser resolver when its fallback approaches the viewport. If the fallback renders no elements, the browser logs a warning and loads the frame immediately.
- **Without `fallback`** (blocking): The frame content is awaited before the initial HTML chunk is sent. The resolved content appears inline.
- **With `fallback`** (non-blocking): The fallback is rendered inline in the initial chunk. Once the frame resolves, a `<template>` element containing the real content is streamed at the end of the response. The client swaps it in automatically.

The blocking and streaming behaviors use `loading="eager"`, which is the default.

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

Components using the `css(...)` mixin through `mix` have their styles collected and deduplicated during rendering, then emitted as `<style data-rmx-style>` tags in the `<head>`, one per generated class. No client-side style injection is needed for server-rendered content.

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

- [Hydration boundaries with clientEntry](https://docs.remix.run/interactivity/#cliententry) - Making server-rendered components interactive on the client
- [Streaming UI with Frames](https://docs.remix.run/streaming-ui-with-frames/) - Streaming partial server UI with `<Frame>`
