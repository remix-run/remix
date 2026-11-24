Connect a `<Frame>` to a server-sent event stream to keep its UI up to date over one connection. A frame whose source answers with `Content-Type: text/event-stream` renders each event's HTML as it arrives, reconciled the same way reload HTML is, so matching elements keep their DOM, focus, and scroll position:

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

The frame resolves as soon as the first event renders, which replaces its `fallback` and settles `frame.reload()` while the connection stays open for later events.

An event named `append` adds its HTML after what the frame already shows, for streams that only grow, such as a log or a feed. Appended HTML joins the frame's content rather than an element inside it, so the list or scroll container belongs around the `<Frame>`; existing nodes are left alone, keeping their client entries and state. Any other event name is a snapshot that replaces everything the frame shows, so one stream can catch a frame up and then append to it.

Frames dispatch a bubbling `rmx:update` event after each event renders, carrying `detail.kind` of `append` or `replace`, so UI around a frame can react to content it did not render itself:

```tsx
<div mix={on('rmx:update', (event) => setCount(event.currentTarget.querySelectorAll('li').length))}>
  <Frame src="/orders/42/live" fallback={<p>Connecting…</p>} />
</div>
```

Frames reading the same source share one connection, and a frame joining an open one is caught up with the last snapshot and the appends since it. A connection that drops is requested again while frames are still reading it, sending `Last-Event-Id` so the server can resume, and waits for the delay the stream asked for with `retry:`. The connection closes once the last frame stops reading it.

The default frame resolver now sends `Accept: text/html, text/event-stream`, so one route can serve a document, a fragment, or a live stream depending on the request.
