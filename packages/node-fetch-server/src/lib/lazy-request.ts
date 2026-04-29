import type * as http from 'node:http'
import type * as http2 from 'node:http2'

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
      return this.#consumeBody().then((body) => body.toString())
    }

    #consumeBody(): Promise<Buffer> {
      if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve(Buffer.alloc(0))
      if (this.#bodyUsed) return Promise.reject(bodyUnusable())
      this.#bodyUsed = true
      return readRequestBody(this.#req)
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
    return this.#consumeBody().then((body) => body.toString())
  }

  #consumeBody(): Promise<Buffer> {
    if (!requestMethodCanHaveBody(this.#method)) return Promise.resolve(Buffer.alloc(0))
    if (this.#bodyUsed) return Promise.reject(bodyUnusable())
    this.#bodyUsed = true
    return readRequestBody(this.#req)
  }
}

Object.setPrototypeOf(LazyRequest.prototype, Request.prototype)

function requestMethodCanHaveBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

async function readRequestBody(req: IncomingRequest): Promise<Buffer> {
  let chunks: Buffer[] = []
  let length = 0

  for await (let chunk of req) {
    let buffer = toBuffer(chunk)
    chunks.push(buffer)
    length += buffer.byteLength
  }

  if (chunks.length === 0) return Buffer.alloc(0)
  if (chunks.length === 1) return chunks[0]

  return Buffer.concat(chunks, length)
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk
  if (typeof chunk === 'string') return Buffer.from(chunk)
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }

  return Buffer.from(String(chunk))
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
