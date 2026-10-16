export interface EventStreamClientMessage {
  event: string
  id?: string
  retry?: number
  data: string
}

export interface EventStreamParser {
  feed(chunk: string): EventStreamClientMessage[]
  end(): EventStreamClientMessage[]
  reset(): void
}

export interface EventStreamConnection {
  readonly signal: AbortSignal
  close(): void
}

export interface ConnectEventStreamOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal
  events?: readonly string[]
  eventSource?: typeof EventSource
  fetch?: typeof fetch
  onMessage(message: EventStreamClientMessage): void
  onOpen?(response?: Response): void
  onError?(error: unknown): void
}

export function parseEventStream(input: string): EventStreamClientMessage[] {
  let parser = createEventStreamParser()
  let messages = parser.feed(input)
  messages.push(...parser.end())
  return messages
}

export function createEventStreamParser(): EventStreamParser {
  let buffer = ''
  let event = ''
  let data = ''
  let lastEventId: string | undefined
  let retry: number | undefined

  function dispatch(messages: EventStreamClientMessage[]): void {
    if (data === '') {
      event = ''
      retry = undefined
      return
    }

    let message: EventStreamClientMessage = {
      event: event || 'message',
      data: data.endsWith('\n') ? data.slice(0, -1) : data,
    }

    if (lastEventId !== undefined) {
      message.id = lastEventId
    }

    if (retry !== undefined) {
      message.retry = retry
    }

    messages.push(message)
    event = ''
    data = ''
    retry = undefined
  }

  function processLine(line: string, messages: EventStreamClientMessage[]): void {
    if (line === '') {
      dispatch(messages)
      return
    }

    if (line.startsWith(':')) {
      return
    }

    let separatorIndex = line.indexOf(':')
    let field = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    let value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1)

    if (value.startsWith(' ')) {
      value = value.slice(1)
    }

    switch (field) {
      case 'event':
        event = value
        break
      case 'data':
        data += `${value}\n`
        break
      case 'id':
        if (!value.includes('\0')) {
          lastEventId = value
        }
        break
      case 'retry':
        if (/^\d+$/.test(value)) {
          retry = Number(value)
        }
        break
    }
  }

  function drainBuffer(messages: EventStreamClientMessage[]): void {
    while (buffer.length > 0) {
      let lineBreakIndex = findLineBreak(buffer)

      if (lineBreakIndex === -1) {
        return
      }

      if (buffer[lineBreakIndex] === '\r' && lineBreakIndex === buffer.length - 1) {
        return
      }

      let line = buffer.slice(0, lineBreakIndex)
      let lineBreakLength =
        buffer[lineBreakIndex] === '\r' && buffer[lineBreakIndex + 1] === '\n' ? 2 : 1

      buffer = buffer.slice(lineBreakIndex + lineBreakLength)
      processLine(line, messages)
    }
  }

  return {
    feed(chunk: string): EventStreamClientMessage[] {
      let messages: EventStreamClientMessage[] = []
      buffer += chunk
      drainBuffer(messages)
      return messages
    },
    end(): EventStreamClientMessage[] {
      let messages: EventStreamClientMessage[] = []

      if (buffer === '\r') {
        processLine('', messages)
      } else if (buffer.length > 0) {
        processLine(buffer, messages)
      }

      buffer = ''
      return messages
    },
    reset(): void {
      buffer = ''
      event = ''
      data = ''
      lastEventId = undefined
      retry = undefined
    },
  }
}

export function connectEventStream(
  input: string | URL,
  options: ConnectEventStreamOptions,
): EventStreamConnection {
  let nativeConnection = connectWithEventSource(input, options)

  if (nativeConnection !== undefined) {
    return nativeConnection
  }

  return connectWithFetch(input, options)
}

function connectWithEventSource(
  input: string | URL,
  options: ConnectEventStreamOptions,
): EventStreamConnection | undefined {
  let EventSourceConstructor = options.eventSource ?? globalThis.EventSource

  if (EventSourceConstructor === undefined || !canUseEventSource(options)) {
    return undefined
  }

  let abortController = new AbortController()
  let closed = false
  let eventNames = options.events ?? ['message']
  let eventSource = new EventSourceConstructor(input.toString(), {
    withCredentials: options.credentials === 'include',
  })

  function open(): void {
    options.onOpen?.()
  }

  function error(event: Event): void {
    options.onError?.(event)
  }

  function message(event: Event): void {
    if (!('data' in event) || typeof event.data !== 'string') {
      return
    }

    let lastEventId =
      'lastEventId' in event && typeof event.lastEventId === 'string' ? event.lastEventId : ''
    let parsed: EventStreamClientMessage = {
      event: event.type,
      data: event.data,
    }

    if (lastEventId !== '') {
      parsed.id = lastEventId
    }

    options.onMessage(parsed)
  }

  function close(reason?: unknown): void {
    if (closed) {
      return
    }

    closed = true
    options.signal?.removeEventListener('abort', abort)
    eventSource.removeEventListener('open', open)
    eventSource.removeEventListener('error', error)

    for (let eventName of eventNames) {
      eventSource.removeEventListener(eventName, message)
    }

    eventSource.close()

    if (!abortController.signal.aborted) {
      abortController.abort(reason)
    }
  }

  function abort(): void {
    close(options.signal?.reason)
  }

  eventSource.addEventListener('open', open)
  eventSource.addEventListener('error', error)

  for (let eventName of eventNames) {
    eventSource.addEventListener(eventName, message)
  }

  if (options.signal?.aborted) {
    close(options.signal.reason)
  } else {
    options.signal?.addEventListener('abort', abort, { once: true })
  }

  return {
    signal: abortController.signal,
    close,
  }
}

function connectWithFetch(
  input: string | URL,
  options: ConnectEventStreamOptions,
): EventStreamConnection {
  let fetchFunction = options.fetch ?? globalThis.fetch

  if (fetchFunction === undefined) {
    throw new TypeError('Event stream fetch fallback requires a fetch implementation')
  }

  let abortController = new AbortController()
  let closed = false

  function close(reason?: unknown): void {
    if (closed) {
      return
    }

    closed = true
    options.signal?.removeEventListener('abort', abort)

    if (!abortController.signal.aborted) {
      abortController.abort(reason)
    }
  }

  function abort(): void {
    close(options.signal?.reason)
  }

  if (options.signal?.aborted) {
    close(options.signal.reason)
  } else {
    options.signal?.addEventListener('abort', abort, { once: true })
  }

  void readFetchStream(input, options, fetchFunction, abortController.signal).then(
    () => close(),
    (error) => {
      if (!abortController.signal.aborted) {
        options.onError?.(error)
      }

      close(error)
    },
  )

  return {
    signal: abortController.signal,
    close,
  }
}

async function readFetchStream(
  input: string | URL,
  options: ConnectEventStreamOptions,
  fetchFunction: typeof fetch,
  signal: AbortSignal,
): Promise<void> {
  let init = createFetchInit(options, signal)
  let response = await fetchFunction(input, init)
  options.onOpen?.(response)

  if (response.body === null) {
    throw new TypeError('Event stream response does not have a body')
  }

  let parser = createEventStreamParser()
  let decoder = new TextDecoder()
  let reader = response.body.getReader()

  try {
    while (true) {
      let result = await reader.read()

      if (result.done) {
        for (let message of parser.end()) {
          options.onMessage(message)
        }

        return
      }

      for (let message of parser.feed(decoder.decode(result.value, { stream: true }))) {
        options.onMessage(message)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function createFetchInit(options: ConnectEventStreamOptions, signal: AbortSignal): RequestInit {
  return {
    body: options.body,
    cache: options.cache,
    credentials: options.credentials,
    headers: options.headers,
    integrity: options.integrity,
    keepalive: options.keepalive,
    method: options.method,
    mode: options.mode,
    redirect: options.redirect,
    referrer: options.referrer,
    referrerPolicy: options.referrerPolicy,
    signal,
  }
}

function canUseEventSource(options: ConnectEventStreamOptions): boolean {
  if (options.fetch !== undefined || options.headers !== undefined || options.body !== undefined) {
    return false
  }

  if (options.method !== undefined && options.method.toUpperCase() !== 'GET') {
    return false
  }

  return true
}

function findLineBreak(input: string): number {
  let carriageReturnIndex = input.indexOf('\r')
  let lineFeedIndex = input.indexOf('\n')

  if (carriageReturnIndex === -1) {
    return lineFeedIndex
  }

  if (lineFeedIndex === -1) {
    return carriageReturnIndex
  }

  return Math.min(carriageReturnIndex, lineFeedIndex)
}
