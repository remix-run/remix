import { appendFlushMarker, inferFlushKind } from './stream-protocol.ts'

const LIVE_FRAME_STREAM = Symbol('LiveFrameStream')

type TaggedStream = ReadableStream<Uint8Array> & { [LIVE_FRAME_STREAM]?: true }

/**
 * A block of a server-sent event stream, completed by its blank line.
 */
export type ServerSentEvent = {
  /** The block's `data:` fields joined with newlines, empty when it only set `id` or `retry`. */
  data: string
  /** Last event id announced by the block, when it carried one. */
  id?: string
  /** Reconnection delay in milliseconds announced by the block, when it carried one. */
  retry?: number
}

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
 * Creates an incremental server-sent event parser.
 *
 * Event names are ignored, so any name works, and comment lines such as `: ping` are dropped,
 * which makes them the keepalive for an otherwise idle connection.
 *
 * @returns A function that takes decoded stream text and returns the event blocks it completed.
 */
export function createEventParser(): (text: string) => ServerSentEvent[] {
  let buffer = ''
  let data = ''
  let id: string | undefined
  let retry: number | undefined
  let started = false

  return (text) => {
    buffer += text
    if (!started) {
      started = true
      if (buffer.startsWith('﻿')) buffer = buffer.slice(1)
    }

    let events: ServerSentEvent[] = []
    let parsed = parseLines(buffer)
    buffer = parsed.remainder

    for (let line of parsed.lines) {
      if (line === '') {
        events.push({ data: data.endsWith('\n') ? data.slice(0, -1) : data, id, retry })
        data = ''
        id = undefined
        retry = undefined
        continue
      }

      if (line.startsWith(':')) continue

      let separator = line.indexOf(':')
      let field = separator === -1 ? line : line.slice(0, separator)
      let value = separator === -1 ? '' : line.slice(separator + 1)
      if (value.startsWith(' ')) value = value.slice(1)

      if (field === 'data') data += value + '\n'
      else if (field === 'id' && !value.includes('\0')) id = value
      else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value)
    }

    return events
  }
}

/**
 * Serializes frame HTML as one server-sent event block.
 *
 * @param data Event payload, which may span several lines.
 * @returns The block's wire text, including its terminating blank line.
 */
export function serializeEvent(data: string): string {
  return `${data
    .split('\n')
    .map((line) => `data: ${line}`)
    .join('\n')}\n\n`
}

/**
 * Converts a server-sent event body into a stream of frame HTML batches.
 *
 * Every event's data is trusted frame HTML: a full snapshot of the frame's content that is diffed
 * into the live DOM, the same way a flushed HTML batch is.
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
  let parse = createEventParser()

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

          let enqueued = false
          for (let event of parse(decoder.decode(value, { stream: true }))) {
            if (event.data === '') continue
            let html = event.data
            controller.enqueue(encoder.encode(appendFlushMarker(html, inferFlushKind(html))))
            enqueued = true
          }

          if (enqueued) return
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
