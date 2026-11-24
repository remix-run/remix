import { appendFlushMarker, inferFlushKind } from './stream-protocol.ts'

const LIVE_FRAME_STREAM = Symbol('LiveFrameStream')

type TaggedStream = ReadableStream<Uint8Array> & { [LIVE_FRAME_STREAM]?: true }

/**
 * Whether a response carries `text/event-stream` content a frame can render as live HTML.
 *
 * @param response Response returned by a frame resolver.
 * @returns True when the response body is a server-sent event stream.
 */
export function isEventStreamResponse(response: Response): boolean {
  let contentType = response.headers.get('Content-Type')?.toLowerCase()
  return contentType?.split(';')[0]?.trim() === 'text/event-stream'
}

/**
 * Whether a stream renders as live frame content that stays open after its first batch.
 *
 * @param content Frame content under consideration.
 * @returns True when the stream was produced by {@link createLiveFrameStream}.
 */
export function isLiveFrameStream(content: ReadableStream<Uint8Array>): boolean {
  return (content as TaggedStream)[LIVE_FRAME_STREAM] === true
}

/**
 * Marks a derived stream as live so it keeps the live-frame render behavior.
 *
 * @param stream Stream wrapping live frame content.
 * @returns The same stream, tagged as live.
 */
export function markLiveFrameStream(
  stream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  Object.defineProperty(stream, LIVE_FRAME_STREAM, { configurable: true, value: true })
  return stream
}

/**
 * Converts a server-sent event body into a stream of frame HTML batches.
 *
 * Every event's data is trusted frame HTML: a full snapshot of the frame's content that is diffed
 * into the live DOM, the same way a flushed HTML batch is. Multi-line `data:` fields are joined
 * with newlines, event names are ignored so any name works, and comment lines such as `: ping`
 * are dropped, which makes them the keepalive for an otherwise idle connection.
 *
 * @param body Response body carrying the event stream.
 * @returns A stream of HTML batches tagged as live frame content.
 */
export function createLiveFrameStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  let reader = body.getReader()
  let decoder = new TextDecoder()
  let encoder = new TextEncoder()
  let buffer = ''
  let data = ''
  let started = false

  function dispatch(controller: ReadableStreamDefaultController<Uint8Array>): boolean {
    if (data === '') return false
    let html = data.endsWith('\n') ? data.slice(0, -1) : data
    data = ''
    controller.enqueue(encoder.encode(appendFlushMarker(html, inferFlushKind(html))))
    return true
  }

  return markLiveFrameStream(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          let { done, value } = await reader.read()
          if (done) {
            // An event without its terminating blank line is incomplete, so it is discarded.
            controller.close()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          if (!started) {
            started = true
            if (buffer.startsWith('﻿')) buffer = buffer.slice(1)
          }

          let dispatched = false
          let parsed = parseLines(buffer)
          buffer = parsed.remainder
          for (let line of parsed.lines) {
            if (line === '') {
              dispatched = dispatch(controller) || dispatched
            } else if (!line.startsWith(':')) {
              let separator = line.indexOf(':')
              let field = separator === -1 ? line : line.slice(0, separator)
              if (field !== 'data') continue
              let value = separator === -1 ? '' : line.slice(separator + 1)
              data += (value.startsWith(' ') ? value.slice(1) : value) + '\n'
            }
          }

          if (dispatched) return
        }
      },
      cancel(reason) {
        return reader.cancel(reason)
      },
    }),
  )
}

// A `\r` at the end of the buffer may still be followed by `\n` in the next chunk, so it stays in
// the remainder until the next read decides whether it ends a line on its own.
function parseLines(buffer: string): { lines: string[]; remainder: string } {
  let lines: string[] = []
  let index = 0

  while (index < buffer.length) {
    let cr = buffer.indexOf('\r', index)
    let lf = buffer.indexOf('\n', index)
    if (cr === -1 && lf === -1) break

    let end: number
    let next: number
    if (cr !== -1 && (lf === -1 || cr < lf)) {
      if (cr === buffer.length - 1) break
      end = cr
      next = buffer[cr + 1] === '\n' ? cr + 2 : cr + 1
    } else {
      end = lf
      next = lf + 1
    }

    lines.push(buffer.slice(index, end))
    index = next
  }

  return { lines, remainder: buffer.slice(index) }
}
