export interface SseSessionOptions {
  /**
   * keepAlive interval to "ensure" session will not be destroyed by proxies / lb
   */
  keepAlive?: number
  /**
   * The reconnection interval handled by the client if the connection is lost
   */
  retry?: number
}

export class SseSession {
  #signal: AbortSignal
  #stream: ReadableStream
  #writer: WritableStreamDefaultWriter
  #connected: boolean
  #lastEventId: string | null
  #keepAliveInterval: ReturnType<typeof setInterval> | null
  #encoder: TextEncoder
  #options?: SseSessionOptions

  /**
   * @param request The underlyning request
   * @param options The session options
   */
  constructor(request: Request, options?: SseSessionOptions) {
    this.#options = options
    let { readable, writable } = new TransformStream()
    this.#writer = writable.getWriter()
    this.#stream = readable
    this.#connected = false
    this.#signal = request.signal
    this.#lastEventId = request.headers.get('last-event-id')
    this.#encoder = new TextEncoder()
    this.#keepAliveInterval = null

    this.#signal.addEventListener('abort', this.disconnect.bind(this), { once: true })
  }

  #write(data: string): void {
    if (!this.connected) throw new Error(`Could not write on disconnected session`)
    this.#writer.write(this.#encoder.encode(`${data}\n`))
  }

  #flush(): void {
    this.#write('')
  }

  #init(): void {
    if (this.#options?.retry) {
      this.retry(this.#options.retry)
    }
    if (this.#options?.keepAlive) {
      this.#keepAliveInterval = setInterval(() => {
        this.comment('')
      }, this.#options.keepAlive)
    }
  }

  /**
   * Inform the client to retry on disconnection
   * @param value retry in ms
   */
  retry(value: number) {
    this.#write(`retry: ${value}`)
    this.#flush()
  }

  /**
   * Send a comment to the client
   * @param data The comment value
   */
  comment(data: string) {
    this.#write(`: ${data}`)
    this.#flush()
  }

  /**
   * Send data to the client
   * @param data The data
   * @param even The event name
   * @param id Id of the current message
   */
  send(data: string, event: string = 'message', id?: string) {
    if (id) {
      this.#lastEventId = id
      this.#write(`id: ${id}`)
    }

    // save some bytes, message is the default event handled by clients on data
    if (event != 'message') {
      this.#write(`event: ${event}`)
    }

    // allow multi-line data
    // TODO: should we clean \r
    for (let part of data.split('\n')) {
      this.#write(`data: ${part}`)
    }
    this.#flush()
  }

  /**
   * Abort the stream
   */
  disconnect() {
    this.#connected = false
    if (this.#keepAliveInterval) {
      clearInterval(this.#keepAliveInterval)
    }
    this.#signal.removeEventListener('abort', this.disconnect)
    this.#writer.close()
  }

  /**
   * The readable stream forwarding event-stream messages
   */
  get stream(): ReadableStream {
    if (this.#signal.aborted) throw new Error(`Request already aborted`)
    if (this.connected) throw new Error(`Stream already consumed`)

    this.#connected = true
    this.#init()
    return this.#stream
  }

  /**
   * Whether this session is connected
   */
  get connected(): boolean {
    return this.#connected
  }

  /**
   * Last event id value
   */
  get lastEventId(): string | null {
    return this.#lastEventId
  }
}

export function createSseSession(request: Request, options?: SseSessionOptions) {
  return new SseSession(request, options)
}
