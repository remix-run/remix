import type { RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'

import { onDrop } from '../data/connections.ts'

/**
 * Sends one event.
 *
 * @param kind `append` adds the HTML to the frame; `replace` replaces what the frame shows.
 * @param render Renders the event's HTML, given the id this event will carry.
 */
export type Publish = (kind: 'replace' | 'append', render: (event: number) => RemixNode) => void

/**
 * Answers a frame with an event stream it stays connected to.
 *
 * @param request Frame request, whose `Last-Event-Id` continues the previous connection's ids.
 * @param open Starts sending events, and returns a function that stops.
 * @returns The streaming response.
 */
export function eventStream(request: Request, open: (publish: Publish) => () => void): Response {
  let encoder = new TextEncoder()
  let event = Number(request.headers.get('Last-Event-Id') ?? 0)
  let close = () => {}

  let stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      // Rendering is async, so events queue behind each other to keep them in order.
      let queue = Promise.resolve()
      let stopSending: (() => void) | undefined
      let stopDrop: (() => void) | undefined

      close = () => {
        if (closed) return
        closed = true
        stopSending?.()
        stopDrop?.()
        request.signal.removeEventListener('abort', close)
        try {
          controller.close()
        } catch {
          // The stream was already closed from the other end.
        }
      }

      let publish: Publish = (kind, render) => {
        queue = queue.then(async () => {
          if (closed) return
          let html = await renderToString(render(event + 1))
          if (closed) return
          event += 1
          controller.enqueue(encoder.encode(serializeEvent(event, html, kind)))
        })
      }

      // Reconnect a second after a stream ends, rather than the three the browser defaults to.
      controller.enqueue(encoder.encode('retry: 1000\n\n'))
      stopSending = open(publish)
      stopDrop = onDrop(close)
      request.signal.addEventListener('abort', close)
    },
    cancel() {
      close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// Frames read `rmx-append` and `rmx-replace`; an unnamed event replaces too, and any other name
// is left for other listeners on the connection.
function serializeEvent(id: number, html: string, kind: 'replace' | 'append'): string {
  let data = html
    .split('\n')
    .map((line) => `data: ${line}`)
    .join('\n')
  return `event: rmx-${kind}\nid: ${id}\n${data}\n\n`
}
