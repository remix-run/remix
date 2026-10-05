import type { HttpRequest, HttpResponse } from '@remix-run/uwebsockets-js'

import { createUwsHeaders } from './uws-headers.ts'

export interface UwsRequestOptions {
  /**
   * Overrides the host portion of the incoming request URL. By default the request URL host is
   * derived from the HTTP `Host` header.
   */
  host?: string
  /**
   * Overrides the protocol of the incoming request URL. Defaults to `http:`.
   */
  protocol?: string
}

export interface UwsResponseState {
  aborted: boolean
  completed: boolean
  responseStarted: boolean
  requestBody: ReadableStream<Uint8Array> | undefined
  abortBody: (() => void) | undefined
  controller: AbortController | undefined
}

export function createUwsRequest(
  req: HttpRequest,
  res: HttpResponse,
  state: UwsResponseState,
  options?: UwsRequestOptions,
  method = req.getCaseSensitiveMethod(),
): Request {
  let init: RequestInit = {
    method,
    headers: createRequestHeaders(req),
    signal: getAbortSignal(state),
  }

  if (requestMethodCanHaveBody(method)) {
    init.body = state.requestBody = createBodyStream(res, state)
    ;(init as { duplex: 'half' }).duplex = 'half'
  }

  return new Request(createRequestUrl(req, options), init)
}

function createRequestHeaders(req: HttpRequest): Headers {
  let entries: [string, string][] = []
  req.forEach((key, value) => {
    entries.push([key, value])
  })
  return createUwsHeaders(entries)
}

export function getAbortSignal(state: UwsResponseState): AbortSignal {
  let controller = (state.controller ??= new AbortController())
  if (state.aborted) controller.abort()
  return controller.signal
}

function createRequestUrl(req: HttpRequest, options: UwsRequestOptions | undefined): string {
  let protocol = options?.protocol ?? 'http:'
  let host = options?.host ?? (req.getHeader('host') || 'localhost')
  let query = req.getQuery()
  return `${protocol}//${host}${req.getUrl()}${query === '' ? '' : `?${query}`}`
}

function createBodyStream(res: HttpResponse, state: UwsResponseState): ReadableStream<Uint8Array> {
  let closed = false
  let paused = false

  function resume() {
    // Native resume restores the event mask captured by pause.
    if (paused && !state.aborted && !state.completed) {
      paused = false
      res.resume()
    }
  }

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        state.abortBody = () => {
          if (closed) return
          closed = true
          state.abortBody = undefined
          controller.error(new Error('Request aborted'))
          resume()
        }

        res.onData((chunk, isLast) => {
          if (closed || state.aborted || state.completed) return
          if (chunk.byteLength !== 0) controller.enqueue(new Uint8Array(chunk).slice())
          if (isLast) {
            closed = true
            state.abortBody = undefined
            controller.close()
            resume()
          } else if (!paused && controller.desiredSize !== null && controller.desiredSize <= 0) {
            paused = true
            res.pause()
          }
        })
      },
      pull() {
        if (!closed) resume()
      },
      cancel() {
        closed = true
        state.abortBody = undefined
        resume()
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: 64 * 1024 }),
  )
}

function requestMethodCanHaveBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}
