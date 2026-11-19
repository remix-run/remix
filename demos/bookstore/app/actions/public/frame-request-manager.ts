interface FrameRequestManager {
  fetch(url: string, init: RequestInit): Promise<Response>
  get(url: string, init: RequestInit): Promise<Response> | undefined
  invalidate(): void
}

interface Consumer {
  resolve(response: Response): void
  reject(reason: unknown): void
  controller: ReadableStreamDefaultController<Uint8Array> | undefined
  signal: AbortSignal
  abort(): void
}

interface PendingRequest {
  subscribe(signal: AbortSignal | null | undefined): Promise<Response>
  controller: AbortController
  consumers: Set<Consumer>
  response: Response | undefined
  chunks: Uint8Array[]
  finished: boolean
}

export function createFrameRequestManager(
  signal: AbortSignal,
  fetchRequest: (url: string, init: RequestInit) => Promise<Response> = globalThis.fetch,
): FrameRequestManager {
  let pending = new Map<string, PendingRequest>()

  return {
    get(src, init) {
      if ((init.method ?? 'GET').toUpperCase() !== 'GET') return
      return pending.get(getRequestKey(src, init))?.subscribe(init.signal)
    },
    invalidate() {
      pending.clear()
    },
    fetch(src, init) {
      if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
        // A mutation can change the session cookie; later GETs must not join earlier work.
        pending.clear()
        return fetchRequest(src, init).finally(() => pending.clear())
      }

      if (signal.aborted) return Promise.reject(signal.reason)
      if (init.signal?.aborted) return Promise.reject(init.signal.reason)

      let url = new URL(src)
      url.hash = ''
      let key = getRequestKey(url.href, init)
      let entry = pending.get(key)
      let isNew = entry === undefined
      if (!entry) {
        entry = {
          subscribe,
          controller: new AbortController(),
          consumers: new Set(),
          response: undefined,
          chunks: [],
          finished: false,
        }
        pending.set(key, entry)
      }
      let request = entry

      let response = request.subscribe(init.signal)
      if (isNew) void load(request)
      return response

      function subscribe(callerSignal: AbortSignal | null | undefined): Promise<Response> {
        let ownerSignal = callerSignal ? AbortSignal.any([signal, callerSignal]) : signal
        if (ownerSignal.aborted) return Promise.reject(ownerSignal.reason)
        return new Promise<Response>((resolve, reject) => {
          let consumer: Consumer = {
            resolve,
            reject,
            controller: undefined,
            signal: ownerSignal,
            abort() {
              consumer.controller?.error(ownerSignal.reason)
              reject(ownerSignal.reason)
              release(consumer)
            },
          }
          request.consumers.add(consumer)
          ownerSignal.addEventListener('abort', consumer.abort, { once: true })
          if (request.response) deliver(consumer, request.response)
        })
      }

      function release(consumer: Consumer) {
        consumer.signal.removeEventListener('abort', consumer.abort)
        request.consumers.delete(consumer)
        if (!request.finished && request.consumers.size === 0) {
          finish(request)
          request.controller.abort()
        }
      }

      function deliver(consumer: Consumer, response: Response) {
        if (!response.body) {
          consumer.resolve(response.clone())
          release(consumer)
          return
        }
        let body = new ReadableStream<Uint8Array>({
          start(controller) {
            consumer.controller = controller
            for (let chunk of request.chunks) controller.enqueue(chunk.slice())
          },
          cancel() {
            release(consumer)
          },
        })
        consumer.resolve(new FrameResponse(body, response))
      }

      async function load(request: PendingRequest) {
        try {
          let response = await fetchRequest(url.href, {
            ...init,
            signal: request.controller.signal,
          })
          if (request.finished) {
            await response.body?.cancel()
            return
          }
          request.response = response
          for (let consumer of request.consumers) deliver(consumer, response)
          if (!response.body) return

          let reader = response.body.getReader()
          try {
            while (!request.finished) {
              let { done, value } = await reader.read()
              if (done || request.finished || value === undefined) break
              // Retain the prefix only while new callers can join this streaming response.
              request.chunks.push(value)
              for (let consumer of request.consumers) consumer.controller?.enqueue(value.slice())
            }
          } finally {
            reader.releaseLock()
          }
          for (let consumer of request.consumers) consumer.controller?.close()
        } catch (error) {
          for (let consumer of request.consumers) {
            consumer.controller?.error(error)
            consumer.reject(error)
          }
        } finally {
          finish(request)
          for (let consumer of request.consumers) release(consumer)
        }
      }

      function finish(request: PendingRequest) {
        request.finished = true
        request.chunks = []
        request.response = undefined
        if (pending.get(key) === request) pending.delete(key)
      }
    },
  }
}

function getRequestKey(src: string, init: RequestInit): string {
  let url = new URL(src)
  url.hash = ''
  let headers = new Headers(init.headers)
  let target = headers.get('X-Remix-Target')
  headers.delete('X-Remix-Target')
  headers.delete('X-Remix-Prefetch')
  return JSON.stringify([
    url.href,
    target,
    [...headers].sort(([a], [b]) => a.localeCompare(b)),
    init.credentials ?? 'same-origin',
    init.mode ?? 'same-origin',
    init.cache ?? 'default',
    init.redirect ?? 'follow',
    init.referrer,
    init.referrerPolicy,
    init.integrity,
  ])
}

// Replacing a response body loses the fetch metadata needed for redirects and relative assets.
class FrameResponse extends Response {
  #url: string
  #redirected: boolean
  #type: ResponseType

  constructor(body: ReadableStream<Uint8Array> | null, source: Response) {
    super(body, { status: source.status, statusText: source.statusText, headers: source.headers })
    this.#url = source.url
    this.#redirected = source.redirected
    this.#type = source.type
  }

  override get url() {
    return this.#url
  }

  override get redirected() {
    return this.#redirected
  }

  override get type() {
    return this.#type
  }

  override clone(): Response {
    return new FrameResponse(super.clone().body, this)
  }
}
