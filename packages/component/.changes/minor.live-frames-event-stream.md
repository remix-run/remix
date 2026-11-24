Connect a `<Frame>` to a server-sent event stream to keep its UI up to date over one connection. A frame whose source answers with `Content-Type: text/event-stream` renders each event's `data` as a snapshot of its HTML, reconciled the same way reload HTML is, so matching elements keep their DOM, focus, and scroll position:

```tsx
<Frame name="order" src="/orders/42/live" fallback={<p>Connecting…</p>} />
```

```tsx
// The route behind `src` keeps the response open and writes one event per update
let stream = new ReadableStream<Uint8Array>({
  async start(controller) {
    let encoder = new TextEncoder()
    for await (let order of watchOrder(42)) {
      let html = await renderToString(<OrderStatus order={order} />)
      controller.enqueue(encoder.encode(`data: ${html}\n\n`))
    }
    controller.close()
  },
})

return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
```

The frame resolves as soon as the first event renders, which replaces its `fallback` and settles `frame.reload()` while the connection stays open for later events. Event names are ignored, comment lines such as `: ping` are the keepalive for an idle connection, and the connection closes when the frame reloads, renders other content, or is removed. Remix doesn't reconnect on its own; call `frame.reload()` when the frame should reconnect.

The default frame resolver now sends `Accept: text/html, text/event-stream`, so one route can serve a document, a fragment, or a live stream depending on the request.
