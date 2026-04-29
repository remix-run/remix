import type * as http from 'node:http'
import type * as http2 from 'node:http2'

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

class LazyRequest<requestOptions> implements Request {
  #request: Request | undefined
  #headers: Headers | undefined
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
    return this.#materialize().bodyUsed
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
    return (this.#headers ??= this.#createHeaders(this.#req))
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
    return this.#materialize().arrayBuffer()
  }

  blob() {
    return this.#materialize().blob()
  }

  bytes() {
    return this.#materialize().bytes()
  }

  clone() {
    return this.#materialize().clone()
  }

  formData() {
    return this.#materialize().formData()
  }

  json() {
    return this.#materialize().json()
  }

  text() {
    return this.#materialize().text()
  }
}

Object.setPrototypeOf(LazyRequest.prototype, Request.prototype)
