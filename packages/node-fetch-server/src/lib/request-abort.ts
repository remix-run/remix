import type * as http from 'node:http'
import type * as http2 from 'node:http2'

const requestAbortReasons = new WeakSet<object>()

export class RequestLifecycle {
  #controller = new AbortController()
  #finished = false
  #closed = false
  responseReader: ReadableStreamDefaultReader<Uint8Array> | undefined

  get signal(): AbortSignal {
    return this.#controller.signal
  }

  get closed(): boolean {
    return this.#closed
  }

  abort(reason?: unknown): void {
    if (!this.#finished) this.#controller.abort(reason)
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    if (!this.#finished) this.#controller.abort()
    if (this.responseReader !== undefined) {
      void this.responseReader.cancel().catch(() => undefined)
    }
  }

  finish(): void {
    this.#finished = true
  }
}

export function observeResponseForRequestLifecycle(
  res: http.ServerResponse | http2.Http2ServerResponse,
  lifecycle: RequestLifecycle,
): void {
  // Abort once we can no longer write a response if we have
  // not yet sent a response (i.e., `close` without `finish`)
  // `finish` -> done rendering the response
  // `close` -> response can no longer be written to
  res.on('close', () => lifecycle.close())
  res.on('finish', () => lifecycle.finish())
}

export function isRequestAlreadyAborted(
  req: http.IncomingMessage | http2.Http2ServerRequest,
): boolean {
  if ('aborted' in req && req.aborted === true) return true
  if ('readableAborted' in req && req.readableAborted === true) return true
  return req.destroyed && !isRequestComplete(req)
}

function isRequestComplete(req: http.IncomingMessage | http2.Http2ServerRequest): boolean {
  if ('complete' in req && req.complete === true) return true
  return req.readableEnded
}

export function createRequestAbortError(): DOMException {
  let error = new DOMException('The request was aborted.', 'AbortError')
  markRequestAbortReason(error)
  return error
}

export function markRequestAbortReason(error: unknown): void {
  if (error != null && (typeof error === 'object' || typeof error === 'function')) {
    requestAbortReasons.add(error)
  }
}

export function isRequestAbortReason(error: unknown): boolean {
  return (
    error != null &&
    (typeof error === 'object' || typeof error === 'function') &&
    requestAbortReasons.has(error)
  )
}
