import type { HttpRequest, HttpResponse } from 'uWebSockets.js'

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
    init.body = createBodyStream(readUwsRequestBody(res, state))
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

function getAbortSignal(state: UwsResponseState): AbortSignal {
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

function createBodyStream(body: Promise<Buffer>): ReadableStream<Uint8Array> {
  let sent = false

  return new ReadableStream({
    pull: async (controller) => {
      if (sent) return
      sent = true

      let buffer = await body
      if (buffer.byteLength !== 0) controller.enqueue(bufferToBytes(buffer))
      controller.close()
    },
  })
}

function requestMethodCanHaveBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function bufferToBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  let bytes = new Uint8Array(buffer.byteLength)
  bytes.set(buffer)
  return bytes
}

function readUwsRequestBody(res: HttpResponse, state: UwsResponseState): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let firstChunk: Buffer | undefined
    let chunks: Buffer[] | undefined
    let length = 0

    state.abortBody = () => {
      reject(new Error('Request aborted'))
    }

    res.onData((chunk, isLast) => {
      if (state.aborted) return

      if (chunk.byteLength !== 0) {
        let buffer = Buffer.from(new Uint8Array(chunk))
        length += buffer.byteLength

        if (firstChunk == null) {
          firstChunk = buffer
        } else {
          chunks ??= [firstChunk]
          chunks.push(buffer)
        }
      }

      if (isLast) {
        state.abortBody = undefined

        if (firstChunk == null) {
          resolve(Buffer.alloc(0))
        } else if (chunks == null) {
          resolve(firstChunk)
        } else {
          resolve(Buffer.concat(chunks, length))
        }
      }
    })
  })
}
