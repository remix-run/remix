# Server Rendering

Remix Component can render to HTML on the server using two APIs:

- `renderToString` - Returns a complete HTML string. Simple, but buffers the entire response.
- `renderToStream` - Returns a `ReadableStream<Uint8Array>`. Sends the initial HTML immediately and streams frame content as it resolves.

Both are exported from `@remix-run/component/server`.

## renderToString

Renders a component tree to a complete HTML string. Use this when you need the full output before responding (e.g., generating static pages or embedding HTML in an email).

```tsx
import { renderToString } from '@remix-run/component/server'

let html = await renderToString(<App />)
```

## renderToStream

Renders a component tree to a streaming response. The initial HTML is sent immediately. Any `<Frame>` components with a `fallback` prop will render the fallback first, then stream the resolved content as it becomes available.

```tsx
import { renderToStream } from '@remix-run/component/server'

let stream = renderToStream(<App />, {
  resolveFrame(src) {
    return fetchHtml(src)
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

- **`resolveFrame(src)`** - Called when a `<Frame>` needs its content. Return a string of HTML, a `ReadableStream<Uint8Array>`, or a promise of either. Required if your component tree contains `<Frame>` elements.
- **`onError(error)`** - Called when a rendering error occurs. If not provided, the stream rejects with the error.

### Streaming behavior

When the stream encounters a `<Frame>` component:

- **Without `fallback`** (blocking): The frame content is awaited before the initial HTML chunk is sent. The resolved content appears inline.
- **With `fallback`** (non-blocking): The fallback is rendered inline in the initial chunk. Once the frame resolves, a `<template>` element containing the real content is streamed at the end of the response. The client swaps it in automatically.

This means the first chunk always contains a complete, renderable page. Slow data sources don't block the initial paint.

## Head management

Elements like `<title>`, `<meta>`, `<link>`, and `<style>` are automatically hoisted to the `<head>` during rendering, regardless of where they appear in the component tree:

```tsx
function ProductPage() {
  return () => (
    <div>
      <title>Product Name</title>
      <meta name="description" content="A great product" />
      <h1>Product Name</h1>
    </div>
  )
}
```

The `<title>` and `<meta>` elements will appear in `<head>`, not in the `<div>`.

## CSS

Components using the `css` prop have their styles collected during rendering and emitted as a single `<style>` tag in the `<head>`. No client-side style injection is needed for server-rendered content.

## See Also

- [Hydration](./hydration.md) - Making server-rendered components interactive on the client
- [Frames](./frames.md) - Streaming partial server UI with `<Frame>`
