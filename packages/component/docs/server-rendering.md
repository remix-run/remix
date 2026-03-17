# Server Rendering

Remix Component can render to HTML on the server using two APIs:

- `renderToString` - Returns a complete HTML string. Simple, but buffers the entire response.
- `renderToStream` - Returns a `ReadableStream<Uint8Array>`. Sends the initial HTML immediately and streams frame content as it resolves.

Both are exported from `remix/component/server`.

## renderToString

Renders a component tree to a complete HTML string. Use this when you need the full output before responding (e.g., generating static pages or embedding HTML in an email).

```tsx
import { renderToString } from 'remix/component/server'

let html = await renderToString(<App />)
```

## renderToStream

Renders a component tree to a streaming response. The initial HTML is sent immediately. Any `<Frame>` components with a `fallback` prop will render the fallback first, then stream the resolved content as it becomes available.

```tsx
import { renderToStream } from 'remix/component/server'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  resolveFrame(src, _target, context) {
    let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url)
    return fetchHtml(frameUrl)
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
- **`resolveFrame(src, target, context)`** - Called when a `<Frame>` needs its content. Return a string of HTML, a `ReadableStream<Uint8Array>`, or a promise of either. `context.currentFrameSrc` is the URL for the frame that contains the `<Frame>`, and `context.topFrameSrc` is the outer document URL. Required if your component tree contains `<Frame>` elements.
- **`onError(error)`** - Called when a rendering error occurs. If not provided, the stream rejects with the error.

When you render nested frame responses with `renderToStream()` inside `resolveFrame()`, pass `frameSrc` for the frame being rendered and carry `topFrameSrc` forward from the parent context. That preserves `handle.frames.top.src` across the whole SSR frame tree.

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

Components using the `css` prop have their styles collected during rendering and emitted as a single `<style>` tag in the `<head>`. No client-side style injection is needed for server-rendered content.

## See Also

- [Hydration](./hydration.md) - Making server-rendered components interactive on the client
- [Frames](./frames.md) - Streaming partial server UI with `<Frame>`
