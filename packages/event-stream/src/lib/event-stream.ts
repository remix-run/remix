import { formatEventStreamMessage, type EventStreamMessage } from './message.ts'

const textEncoder = new TextEncoder()
const contentType = 'text/event-stream'
const cacheControl = 'no-cache'
const connection = 'keep-alive'

export interface EventStreamInit extends ResponseInit {
  request?: Request
  signal?: AbortSignal
  keepAlive?: number
  lastEventId?: string | null
}

export interface EventStreamTextOptions {
  event?: string
  id?: string
  retry?: number
}

export interface StreamTextOptions extends EventStreamTextOptions {
  close?: boolean
}

export type TextStreamSource = Iterable<string> | AsyncIterable<string>

export interface EventStream {
  readonly response: Response
  readonly signal: AbortSignal
  readonly lastEventId: string | null
  send(message: EventStreamMessage): void
  writeText(data: string, options?: EventStreamTextOptions): void
  close(): void
}

export function eventStream(init: EventStreamInit = {}): EventStream {
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined
  let closed = false
  let heartbeat: ReturnType<typeof globalThis.setInterval> | undefined
  let removeAbortListeners: Array<() => void> = []
  let abortController = new AbortController()
  let keepAlive = normalizeKeepAlive(init.keepAlive)
  let lastEventId = init.lastEventId ?? init.request?.headers.get('Last-Event-ID') ?? null

  function cleanup(reason?: unknown): void {
    if (heartbeat !== undefined) {
      globalThis.clearInterval(heartbeat)
      heartbeat = undefined
    }

    for (let removeAbortListener of removeAbortListeners) {
      removeAbortListener()
    }

    removeAbortListeners = []

    if (!abortController.signal.aborted) {
      abortController.abort(reason)
    }
  }

  function finish(reason: unknown, closeController: boolean): void {
    if (closed) {
      return
    }

    closed = true
    cleanup(reason)

    if (closeController && streamController !== undefined) {
      streamController.close()
    }
  }

  function enqueue(frame: string): void {
    if (closed) {
      throw new TypeError('Cannot write to a closed event stream')
    }

    if (streamController === undefined) {
      throw new TypeError('Event stream is not ready')
    }

    streamController.enqueue(textEncoder.encode(frame))
  }

  function send(message: EventStreamMessage): void {
    enqueue(formatEventStreamMessage(message))
  }

  function writeText(data: string, options: EventStreamTextOptions = {}): void {
    let message: EventStreamMessage = { data }

    if (options.event !== undefined) {
      message.event = options.event
    }

    if (options.id !== undefined) {
      message.id = options.id
    }

    if (options.retry !== undefined) {
      message.retry = options.retry
    }

    send(message)
  }

  function close(): void {
    finish(undefined, true)
  }

  function startHeartbeat(): void {
    if (keepAlive === undefined) {
      return
    }

    heartbeat = globalThis.setInterval(() => {
      if (!closed) {
        enqueue(': ping\n\n')
      }
    }, keepAlive)
  }

  let body = new ReadableStream<Uint8Array>({
    start(controller): void {
      streamController = controller
      startHeartbeat()
    },
    cancel(reason): void {
      finish(reason, false)
    },
  })

  watchAbortSignal(init.request?.signal, finish, removeAbortListeners)
  watchAbortSignal(init.signal, finish, removeAbortListeners)

  let response = new Response(body, {
    status: init.status,
    statusText: init.statusText,
    headers: createEventStreamHeaders(init.headers),
  })

  return {
    response,
    signal: abortController.signal,
    lastEventId,
    send,
    writeText,
    close,
  }
}

export async function streamText(
  stream: EventStream,
  source: TextStreamSource,
  options: StreamTextOptions = {},
): Promise<void> {
  let messageOptions = getMessageOptions(options)

  try {
    for await (let chunk of source) {
      if (stream.signal.aborted) {
        break
      }

      stream.writeText(chunk, messageOptions)
    }
  } finally {
    if (options.close !== false) {
      stream.close()
    }
  }
}

function createEventStreamHeaders(headersInit: HeadersInit | undefined): Headers {
  let headers = new Headers(headersInit)
  headers.set('Content-Type', contentType)
  headers.set('Cache-Control', cacheControl)
  headers.set('Connection', connection)
  return headers
}

function normalizeKeepAlive(keepAlive: number | undefined): number | undefined {
  if (keepAlive === undefined) {
    return undefined
  }

  if (!Number.isSafeInteger(keepAlive) || keepAlive <= 0) {
    throw new RangeError('Event stream keepAlive must be a positive safe integer')
  }

  return keepAlive
}

function watchAbortSignal(
  signal: AbortSignal | undefined,
  finish: (reason: unknown, closeController: boolean) => void,
  removeAbortListeners: Array<() => void>,
): void {
  if (signal === undefined) {
    return
  }

  if (signal.aborted) {
    finish(signal.reason, true)
    return
  }

  function abort(): void {
    finish(signal?.reason, true)
  }

  signal.addEventListener('abort', abort, { once: true })
  removeAbortListeners.push(() => signal.removeEventListener('abort', abort))
}

function getMessageOptions(options: StreamTextOptions): EventStreamTextOptions {
  let messageOptions: EventStreamTextOptions = {}

  if (options.event !== undefined) {
    messageOptions.event = options.event
  }

  if (options.id !== undefined) {
    messageOptions.id = options.id
  }

  if (options.retry !== undefined) {
    messageOptions.retry = options.retry
  }

  return messageOptions
}
