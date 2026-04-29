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
): Request {
  return new UwsRequest(req, res, state, options)
}

class UwsRequest implements Request {
  #request: Request | undefined
  #headers: Headers
  #bodyPromise: Promise<Buffer> | undefined
  #bodyUsed = false
  #method: string
  #url: string
  #state: UwsResponseState

  constructor(
    req: HttpRequest,
    res: HttpResponse,
    state: UwsResponseState,
    options: UwsRequestOptions | undefined,
  ) {
    this.#state = state
    this.#method = req.getCaseSensitiveMethod()

    let entries: [string, string][] = []
    req.forEach((key, value) => {
      entries.push([key, value])
    })
    this.#headers = createUwsHeaders(entries)

    let query = req.getQuery()
    let path = req.getUrl()
    let protocol = options?.protocol ?? 'http:'
    let host = options?.host ?? (req.getHeader('host') || 'localhost')
    this.#url = `${protocol}//${host}${path}${query === '' ? '' : `?${query}`}`

    if (requestMethodCanHaveBody(this.#method)) {
      this.#bodyPromise = readUwsRequestBody(res, state)
    }
  }

  #materialize(): Request {
    if (this.#request != null) return this.#request

    let init: RequestInit = {
      method: this.#method,
      headers: this.#headers,
      signal: this.signal,
    }

    if (requestMethodCanHaveBody(this.#method)) {
      init.body = this.#createBodyStream()
      ;(init as { duplex: 'half' }).duplex = 'half'
    }

    return (this.#request = new Request(this.#url, init))
  }

  #createBodyStream(): ReadableStream<Uint8Array> {
    let sent = false

    return new ReadableStream({
      pull: async (controller) => {
        if (sent) return
        sent = true

        let body = await this.#readBody()
        if (body.byteLength !== 0) controller.enqueue(bufferToBytes(body))
        controller.close()
      },
    })
  }

  get body() {
    return this.#materialize().body
  }

  get bodyUsed() {
    return this.#bodyUsed || this.#request?.bodyUsed === true
  }

  get cache() {
    return this.#materialize().cache
  }

  get credentials() {
    return this.#materialize().credentials
  }

  get destination() {
    return this.#materialize().destination
  }

  get headers() {
    return this.#headers
  }

  get integrity() {
    return this.#materialize().integrity
  }

  get keepalive() {
    return this.#materialize().keepalive
  }

  get method() {
    return this.#method
  }

  get mode() {
    return this.#materialize().mode
  }

  get redirect() {
    return this.#materialize().redirect
  }

  get referrer() {
    return this.#materialize().referrer
  }

  get referrerPolicy() {
    return this.#materialize().referrerPolicy
  }

  get signal() {
    let controller = (this.#state.controller ??= new AbortController())
    if (this.#state.aborted) controller.abort()
    return controller.signal
  }

  get url() {
    return this.#url
  }

  arrayBuffer() {
    if (this.#request != null && !this.#bodyUsed) return this.#request.arrayBuffer()
    return this.#consumeBody().then(bufferToArrayBuffer)
  }

  blob() {
    if (this.#request != null && !this.#bodyUsed) return this.#request.blob()
    return this.#consumeBody().then((body) => new Blob([bufferToBytes(body)]))
  }

  bytes() {
    if (this.#request != null && !this.#bodyUsed) return this.#request.bytes()
    return this.#consumeBody().then(bufferToBytes)
  }

  clone() {
    if (this.bodyUsed) throw bodyUnusable()
    return this.#materialize().clone()
  }

  formData() {
    return this.#materialize().formData()
  }

  json() {
    if (this.#request != null && !this.#bodyUsed) return this.#request.json()
    return this.text().then(JSON.parse)
  }

  text() {
    if (this.#request != null && !this.#bodyUsed) return this.#request.text()
    return this.#consumeBody().then((body) => body.toString())
  }

  #consumeBody(): Promise<Buffer> {
    if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve(Buffer.alloc(0))
    if (this.#bodyUsed) return Promise.reject(bodyUnusable())
    this.#bodyUsed = true
    return this.#readBody()
  }

  #readBody(): Promise<Buffer> {
    return this.#bodyPromise ?? Promise.resolve(Buffer.alloc(0))
  }
}

Object.setPrototypeOf(UwsRequest.prototype, Request.prototype)

function requestMethodCanHaveBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return bufferToBytes(buffer).buffer
}

function bufferToBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  let bytes = new Uint8Array(buffer.byteLength)
  bytes.set(buffer)
  return bytes
}

function bodyUnusable(): TypeError {
  return new TypeError('Body is unusable: Body has already been read')
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
