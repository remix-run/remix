import { createEventParser, isEventStreamResponse, serializeEvent } from './event-stream.ts'

/**
 * Requests a frame source, for a live connection's first request and for every reconnection.
 *
 * @param init Cancellation signal, plus the id of the last event received when the stream sent one.
 * @returns The response to read events from.
 */
export type RequestLiveFrame = (init: {
  lastEventId?: string
  signal?: AbortSignal
}) => Promise<Response>

const DEFAULT_RETRY_MS = 3000
const MAX_RETRY_MS = 30_000

type Subscriber = ReadableStreamDefaultController<Uint8Array>

type LiveConnection = {
  url: string
  headers: Headers
  request: RequestLiveFrame
  subscribers: Set<Subscriber>
  // The most recent event, replayed to frames that join an open connection so they render the
  // current state instead of waiting for the next one.
  lastEvent?: Uint8Array
  lastEventId?: string
  retry: number
  controller: AbortController
  closed: boolean
}

const connections = new Map<string, LiveConnection>()
const pending = new Map<string, Promise<LiveConnection | undefined>>()

/**
 * Resolves a frame source that may already be, or may become, a live connection.
 *
 * Frames reading the same source share one connection: the first one requests it, and the rest
 * subscribe to the events it receives. When the source answers with anything but an event stream,
 * each frame gets its own response.
 *
 * @param url Absolute frame source URL, which identifies the connection.
 * @param request Makes the request, and makes it again when a live connection drops.
 * @param signal Cancels this frame's interest in the connection.
 * @returns The frame's own response, or one carrying a share of the live connection.
 */
export async function resolveLiveFrame(
  url: string,
  request: RequestLiveFrame,
  signal?: AbortSignal,
): Promise<Response> {
  let existing = connections.get(url)
  if (existing) return subscribe(existing, signal)

  let inFlight = pending.get(url)
  if (inFlight) {
    let connection = await inFlight
    // The shared request answered with something other than an event stream, so this frame makes
    // its own request for it.
    if (!connection || connection.closed) return await request({ signal })
    return subscribe(connection, signal)
  }

  // Until the response proves to be an event stream it belongs to the frame that asked for it, and
  // that frame's signal cancels it. A live connection outlives the frame, so it takes the body over.
  let controller = new AbortController()
  let abort = () => controller.abort(signal?.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })

  let attempt = (async () => {
    try {
      let response = await request({ signal: controller.signal })
      if (!isEventStreamResponse(response) || !response.ok || !response.body) return { response }
      signal?.removeEventListener('abort', abort)
      return { response, connection: openConnection(url, response, request) }
    } catch (error) {
      signal?.removeEventListener('abort', abort)
      throw error
    }
  })()

  pending.set(
    url,
    attempt.then(
      (result) => result.connection,
      () => undefined,
    ),
  )

  try {
    let { response, connection } = await attempt
    return connection ? subscribe(connection, signal) : response
  } finally {
    pending.delete(url)
  }
}

/** Closes every live connection, used when the runtime that opened them is disposed. */
export function closeLiveFrames(): void {
  for (let connection of [...connections.values()]) close(connection)
}

function openConnection(
  url: string,
  response: Response,
  request: RequestLiveFrame,
): LiveConnection {
  let headers = new Headers({ 'Content-Type': 'text/event-stream' })
  for (let name of ['Content-Security-Policy', 'Content-Security-Policy-Report-Only']) {
    let value = response.headers.get(name)
    if (value) headers.set(name, value)
  }

  let connection: LiveConnection = {
    url,
    headers,
    request,
    subscribers: new Set(),
    retry: DEFAULT_RETRY_MS,
    controller: new AbortController(),
    closed: false,
  }
  connections.set(url, connection)
  void pump(connection, response)
  return connection
}

function subscribe(connection: LiveConnection, signal?: AbortSignal): Response {
  let subscriber: Subscriber | undefined

  let stream = new ReadableStream<Uint8Array>({
    start(controller) {
      subscriber = controller
      connection.subscribers.add(controller)
      if (connection.lastEvent) controller.enqueue(connection.lastEvent)
    },
    cancel() {
      leave(connection, subscriber)
    },
  })

  // A frame that never reads the stream, because a newer reload replaced it, still gives up its
  // share of the connection.
  signal?.addEventListener('abort', () => leave(connection, subscriber), { once: true })

  return new Response(stream, { headers: connection.headers })
}

function leave(connection: LiveConnection, subscriber: Subscriber | undefined): void {
  if (!subscriber || !connection.subscribers.delete(subscriber)) return
  if (connection.subscribers.size === 0) close(connection)
}

// Reads events for as long as frames are watching, requesting the source again whenever the
// stream ends or fails. A response that isn't an event stream ends the connection for good, the
// way a browser `EventSource` stops on one.
async function pump(connection: LiveConnection, initial: Response): Promise<void> {
  let response: Response | undefined = initial
  let failures = 0

  while (!connection.closed) {
    if (response) {
      if (!isEventStreamResponse(response) || !response.ok || !response.body) break
      if ((await read(connection, response.body)) > 0) failures = 0
    }
    if (connection.closed) break

    failures += 1
    if (!(await wait(connection, Math.min(connection.retry * 2 ** (failures - 1), MAX_RETRY_MS)))) {
      break
    }

    response = await connection
      .request({ lastEventId: connection.lastEventId, signal: connection.controller.signal })
      .catch(() => undefined)
  }

  close(connection)
}

async function read(connection: LiveConnection, body: ReadableStream<Uint8Array>): Promise<number> {
  let reader = body.getReader()
  let decoder = new TextDecoder()
  let parse = createEventParser()
  let encoder = new TextEncoder()
  let received = 0

  let abort = () => void reader.cancel().catch(() => {})
  connection.controller.signal.addEventListener('abort', abort, { once: true })

  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break

      for (let event of parse(decoder.decode(value, { stream: true }))) {
        if (event.retry !== undefined) connection.retry = event.retry
        if (event.id !== undefined) connection.lastEventId = event.id
        if (event.data === '') continue

        received += 1
        let bytes = encoder.encode(serializeEvent(event.data))
        connection.lastEvent = bytes
        for (let subscriber of [...connection.subscribers]) {
          try {
            subscriber.enqueue(bytes)
          } catch {
            connection.subscribers.delete(subscriber)
          }
        }
      }
    }
  } catch {
    // A dropped connection reconnects, like any other stream that ends.
  } finally {
    connection.controller.signal.removeEventListener('abort', abort)
  }

  return received
}

function wait(connection: LiveConnection, delay: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer = setTimeout(() => {
      connection.controller.signal.removeEventListener('abort', cancel)
      resolve(!connection.closed)
    }, delay)
    function cancel() {
      clearTimeout(timer)
      resolve(false)
    }
    connection.controller.signal.addEventListener('abort', cancel, { once: true })
  })
}

function close(connection: LiveConnection): void {
  if (connection.closed) return
  connection.closed = true
  if (connections.get(connection.url) === connection) connections.delete(connection.url)
  connection.controller.abort()

  for (let subscriber of [...connection.subscribers]) {
    connection.subscribers.delete(subscriber)
    try {
      subscriber.close()
    } catch {
      // The frame already cancelled its stream.
    }
  }
}
