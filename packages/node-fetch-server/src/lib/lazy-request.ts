import type * as http from 'node:http'
import type * as http2 from 'node:http2'

import { ClientDisconnectError } from './client-disconnect-error.ts'
import { createLazyHeaders } from './lazy-headers.ts'

type IncomingRequest = http.IncomingMessage | http2.Http2ServerRequest
type ServerResponse = http.ServerResponse | http2.Http2ServerResponse
type RequestFactory<requestOptions> = (
  req: IncomingRequest,
  res: ServerResponse,
  options: requestOptions | undefined,
) => Request
type HeadersFactory = (req: IncomingRequest) => Headers

export function createLazyRequest<requestOptions>(
  req: IncomingRequest,
  res: ServerResponse,
  options: requestOptions | undefined,
  createRequest: RequestFactory<requestOptions>,
  createHeaders: HeadersFactory,
): Request {
  return new LazyRequest(req, res, options, createRequest, createHeaders)
}

export function createLazyRequestFactory<requestOptions>(
  options: requestOptions | undefined,
  createRequest: RequestFactory<requestOptions>,
  createHeaders: HeadersFactory,
): (req: IncomingRequest, res: ServerResponse) => Request {
  class BoundLazyRequest implements Request {
    #request: Request | undefined
    #headers: Headers | undefined
    #bodyUsed = false
    #req: IncomingRequest
    #res: ServerResponse
    #method: string

    constructor(req: IncomingRequest, res: ServerResponse) {
      this.#req = req
      this.#res = res
      this.#method = req.method ?? 'GET'
    }

    #materialize(): Request {
      return (this.#request ??= createRequest(this.#req, this.#res, options))
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
      return (this.#headers ??= createLazyHeaders(this.#req, createHeaders))
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
      return this.#materialize().signal
    }

    get url() {
      return this.#materialize().url
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
      return this.#consumeTextBody()
    }

    #consumeBody(): Promise<Buffer> {
      if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve(Buffer.alloc(0))
      if (this.#bodyUsed) return Promise.reject(bodyUnusable())
      this.#bodyUsed = true
      return readRequestBody(this.#req)
    }

    #consumeTextBody(): Promise<string> {
      if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve('')
      if (this.#bodyUsed) return Promise.reject(bodyUnusable())
      this.#bodyUsed = true
      return readRequestText(this.#req)
    }
  }

  Object.setPrototypeOf(BoundLazyRequest.prototype, Request.prototype)

  return (req, res) => new BoundLazyRequest(req, res)
}

class LazyRequest<requestOptions> implements Request {
  #request: Request | undefined
  #headers: Headers | undefined
  #bodyUsed = false
  #req: IncomingRequest
  #res: ServerResponse
  #options: requestOptions | undefined
  #createRequest: RequestFactory<requestOptions>
  #createHeaders: HeadersFactory
  #method: string

  constructor(
    req: IncomingRequest,
    res: ServerResponse,
    options: requestOptions | undefined,
    createRequest: RequestFactory<requestOptions>,
    createHeaders: HeadersFactory,
  ) {
    this.#req = req
    this.#res = res
    this.#options = options
    this.#createRequest = createRequest
    this.#createHeaders = createHeaders
    this.#method = req.method ?? 'GET'
  }

  #materialize(): Request {
    return (this.#request ??= this.#createRequest(this.#req, this.#res, this.#options))
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
    return (this.#headers ??= createLazyHeaders(this.#req, this.#createHeaders))
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
    return this.#materialize().signal
  }

  get url() {
    return this.#materialize().url
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
    return this.#consumeTextBody()
  }

  #consumeBody(): Promise<Buffer> {
    if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve(Buffer.alloc(0))
    if (this.#bodyUsed) return Promise.reject(bodyUnusable())
    this.#bodyUsed = true
    return readRequestBody(this.#req)
  }

  #consumeTextBody(): Promise<string> {
    if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve('')
    if (this.#bodyUsed) return Promise.reject(bodyUnusable())
    this.#bodyUsed = true
    return readRequestText(this.#req)
  }
}

Object.setPrototypeOf(LazyRequest.prototype, Request.prototype)

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

function readRequestBody(req: IncomingRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let firstChunk: Buffer | undefined
    let chunks: Buffer[] | undefined
    let length = 0

    function cleanup() {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      req.off('aborted', onClose)
      req.off('close', onClose)
    }

    function onData(buffer: Buffer) {
      length += buffer.byteLength

      if (firstChunk == null) {
        firstChunk = buffer
      } else {
        chunks ??= [firstChunk]
        chunks.push(buffer)
      }
    }

    function onEnd() {
      cleanup()
      if (firstChunk == null) {
        resolve(Buffer.alloc(0))
      } else if (chunks == null) {
        resolve(firstChunk)
      } else {
        resolve(Buffer.concat(chunks, length))
      }
    }

    // An 'error' before 'end' means the body cannot complete, so it is
    // reported as a disconnect (with the original error as `cause`) to match
    // the request-abort handling in `createRequestListener`.
    function onError(error: Error) {
      cleanup()
      reject(new ClientDisconnectError(error))
    }

    // A 'close' (or legacy 'aborted') before 'end' means the client went away
    // before the body was fully received; a close after 'end' never reaches
    // this handler because 'end' removes these listeners.
    function onClose() {
      cleanup()
      reject(new ClientDisconnectError())
    }

    if (req.readableEnded) {
      resolve(Buffer.alloc(0))
      return
    }

    if (req.destroyed) {
      reject(new ClientDisconnectError())
      return
    }

    req.on('data', onData)
    req.once('end', onEnd)
    req.once('error', onError)
    req.once('aborted', onClose)
    req.once('close', onClose)
  })
}

function readRequestText(req: IncomingRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let firstChunk: Buffer | undefined
    let chunks: Buffer[] | undefined
    let length = 0

    function cleanup() {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      req.off('aborted', onClose)
      req.off('close', onClose)
    }

    function onData(buffer: Buffer) {
      length += buffer.byteLength

      if (firstChunk == null) {
        firstChunk = buffer
      } else {
        chunks ??= [firstChunk]
        chunks.push(buffer)
      }
    }

    function onEnd() {
      cleanup()
      if (firstChunk == null) {
        resolve('')
      } else if (chunks == null) {
        resolve(firstChunk.toString())
      } else {
        resolve(Buffer.concat(chunks, length).toString())
      }
    }

    // Same early-disconnect handling as readRequestBody above.
    function onError(error: Error) {
      cleanup()
      reject(new ClientDisconnectError(error))
    }

    function onClose() {
      cleanup()
      reject(new ClientDisconnectError())
    }

    if (req.readableEnded) {
      resolve('')
      return
    }

    if (req.destroyed) {
      reject(new ClientDisconnectError())
      return
    }

    req.on('data', onData)
    req.once('end', onEnd)
    req.once('error', onError)
    req.once('aborted', onClose)
    req.once('close', onClose)
  })
}
