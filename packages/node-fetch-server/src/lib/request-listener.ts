import type * as http from 'node:http'
import type * as http2 from 'node:http2'
import * as net from 'node:net'

import type { ClientAddress, ErrorHandler, FetchHandler } from './fetch-handler.ts'
import type { RequestLifecycle } from './request-abort.ts'
import {
  createRequestAbortError,
  createRequestLifecycle,
  isRequestAlreadyAborted,
  isRequestAbortReason,
  markRequestAbortReason,
  observeResponseForRequestLifecycle,
} from './request-abort.ts'

/**
 * Options for creating a Node.js request listener.
 */
export interface RequestListenerOptions {
  /**
   * Overrides the host portion of the incoming request URL. By default the request URL host is
   * derived from HTTP/2 `:authority`, falling back to the HTTP `Host` header.
   * The effective host must be a valid hostname or bracketed IPv6 address with an optional port.
   *
   * For example, if you have a `$HOST` environment variable that contains the hostname of your
   * server, you can use it to set the host of all incoming request URLs like so:
   *
   * ```ts
   * createRequestListener(handler, { host: process.env.HOST })
   * ```
   */
  host?: string
  /**
   * An error handler that determines the response when request construction or handling throws.
   * If no response is returned, literal path backslashes, invalid request authorities, and
   * conflicting HTTP/2 authorities receive a 400 Bad Request response. Other errors receive a
   * 500 Internal Server Error response.
   */
  onError?: ErrorHandler
  /**
   * Overrides the protocol of the incoming request URL. By default the request URL protocol is
   * derived from the connection protocol. So e.g. when serving over HTTPS (using
   * `https.createServer()`), the request URL will begin with `https:`.
   */
  protocol?: string
  /**
   * Trusts reverse proxy headers. When enabled, `Forwarded`, `X-Forwarded-Host`, and
   * `X-Forwarded-Proto` can provide the incoming request URL host and protocol when `host` and
   * `protocol` are not set. `Forwarded` and `X-Forwarded-For` can provide the client address for
   * request listeners that read client information. Only enable this when your server is behind a
   * trusted proxy that overwrites these headers.
   */
  trustProxy?: boolean
}

/**
 * Wraps a fetch handler in a Node.js request listener that can be used with:
 *
 * - [`http.createServer()`](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener)
 * - [`https.createServer()`](https://nodejs.org/api/https.html#httpscreateserveroptions-requestlistener)
 * - [`http2.createServer()`](https://nodejs.org/api/http2.html#http2createserveroptions-onrequesthandler)
 * - [`http2.createSecureServer()`](https://nodejs.org/api/http2.html#http2createsecureserveroptions-onrequesthandler)
 *
 * Literal backslashes in the request path, invalid URL hosts, and conflicting HTTP/2 `Host` and
 * `:authority` values are rejected before calling the handler. They produce a 400 response unless
 * `onError` returns a custom response. Backslashes in the query and percent-encoded backslashes
 * remain accepted.
 *
 * Example:
 *
 * ```ts
 * import * as http from 'node:http';
 * import { createRequestListener } from 'remix/node-fetch-server';
 *
 * async function handler(request) {
 *   return new Response('Hello, world!');
 * }
 *
 * let server = http.createServer(
 *   createRequestListener(handler)
 * );
 *
 * server.listen(3000);
 * ```
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Request listener options
 * @returns A Node.js request listener function
 */
export function createRequestListener(
  handler: (request: Request) => Response | Promise<Response>,
  options?: RequestListenerOptions,
): http.RequestListener
export function createRequestListener(
  handler: FetchHandler,
  options?: RequestListenerOptions,
): http.RequestListener
export function createRequestListener(
  handler: FetchHandler,
  options?: RequestListenerOptions,
): http.RequestListener {
  let onError = options?.onError ?? defaultErrorHandler
  let expectsClient = handler.length >= 2

  return (req, res) => {
    let lifecycle = createRequestLifecycle()
    observeResponseForRequestLifecycle(res, lifecycle)

    let request: Request
    try {
      request = createRequestWithLifecycle(req, options, lifecycle)
    } catch (error) {
      return sendResponseForCreationError(res, onError, error, lifecycle)
    }

    let response: Response | Promise<Response>
    try {
      response = expectsClient
        ? handler(request, createClientAddress(req, options))
        : (handler as (request: Request) => Response | Promise<Response>)(request)
    } catch (error) {
      if (isRequestAbortError(request, error)) return Promise.resolve()
      return sendErrorResponseForRequest(res, request, onError, error, lifecycle)
    }

    if (isPromiseLike(response)) {
      return response.then(
        (response) => sendResponseForRequest(res, response, request, onError, lifecycle),
        (error) => {
          if (isRequestAbortError(request, error)) return
          return sendErrorResponseForRequest(res, request, onError, error, lifecycle)
        },
      )
    }

    return sendResponseForRequest(res, response, request, onError, lifecycle)
  }
}

function isResponseClosed(
  res: http.ServerResponse | http2.Http2ServerResponse,
  lifecycle: RequestLifecycle,
): boolean {
  return lifecycle.closed || res.destroyed
}

async function sendResponseForCreationError(
  res: http.ServerResponse | http2.Http2ServerResponse,
  onError: ErrorHandler,
  error: unknown,
  lifecycle: RequestLifecycle,
): Promise<void> {
  let response = await createErrorResponse(onError, error)
  if (isResponseClosed(res, lifecycle)) return
  await writeResponse(res, response, lifecycle)
}

async function sendErrorResponseForRequest(
  res: http.ServerResponse | http2.Http2ServerResponse,
  request: Request,
  onError: ErrorHandler,
  error: unknown,
  lifecycle: RequestLifecycle,
): Promise<void> {
  let response = await createErrorResponse(onError, error)
  if (isResponseClosed(res, lifecycle) || request.signal.aborted || hasResponseStarted(res)) return
  await writeResponse(res, response, lifecycle)
}

async function sendResponseForRequest(
  res: http.ServerResponse | http2.Http2ServerResponse,
  response: Response,
  request: Request,
  onError: ErrorHandler,
  lifecycle: RequestLifecycle,
): Promise<void> {
  if (isResponseClosed(res, lifecycle) || request.signal.aborted) return
  try {
    await writeResponse(res, response, lifecycle)
  } catch (error) {
    if (isResponseClosed(res, lifecycle)) return
    if (isRequestAbortError(request, error)) return
    if (hasResponseStarted(res)) {
      destroyResponse(res, error)
      void createErrorResponse(onError, error)
      return
    }
    await sendErrorResponseForRequest(res, request, onError, error, lifecycle)
  }
}

async function createErrorResponse(onError: ErrorHandler, error: unknown): Promise<Response> {
  try {
    let response = await onError(error)
    if (response != null) return response
    return error instanceof RequestAuthorityError || error instanceof RequestTargetError
      ? new Response('Bad Request', { status: 400 })
      : internalServerError()
  } catch (error) {
    console.error(`There was an error in the error handler: ${error}`)
    return internalServerError()
  }
}

function defaultErrorHandler(error: unknown): void {
  console.error(error)
}

function internalServerError(): Response {
  return new Response('Internal Server Error', {
    status: 500,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

function isPromiseLike<value>(value: value | PromiseLike<value>): value is PromiseLike<value> {
  return typeof (value as { then?: unknown }).then === 'function'
}

function isRequestAbortError(request: Request, error: unknown): boolean {
  return isRequestAbortReason(error) || (request.signal.aborted && error === request.signal.reason)
}

function hasResponseStarted(res: http.ServerResponse | http2.Http2ServerResponse): boolean {
  return res.headersSent
}

function destroyResponse(
  res: http.ServerResponse | http2.Http2ServerResponse,
  error: unknown,
): void {
  if (res.destroyed) return
  if (error instanceof Error) {
    res.destroy(error)
  } else {
    res.destroy()
  }
}

function createRequestBodyStream(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  lifecycle: RequestLifecycle,
): ReadableStream<Uint8Array> {
  let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined
  let requestEnded = false
  let bodyClosed = false

  function cleanup({ keepErrorListener = false }: { keepErrorListener?: boolean } = {}) {
    req.removeListener('data', onData)
    req.removeListener('end', onEnd)
    if (!keepErrorListener) req.removeListener('error', onError)
    req.removeListener('aborted', onAborted)
    req.removeListener('close', onClose)
  }

  function closeBody() {
    if (bodyClosed) return
    bodyClosed = true
    cleanup()
    bodyController?.close()
  }

  function abortBody(error: unknown, { keepErrorListener = false } = {}) {
    if (bodyClosed) return
    bodyClosed = true
    cleanup({ keepErrorListener })
    lifecycle.abort(error)
    bodyController?.error(error)
  }

  function cancelBody() {
    if (bodyClosed) return
    bodyClosed = true
    cleanup()
  }

  function onData(chunk: Buffer) {
    if (bodyController == null) return
    bodyController.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength))

    // Apply backpressure: once the stream's queue is full, stop pulling data off the socket until
    // the consumer reads (see pull() below). Without this, an unread request body (e.g. a handler
    // that rejects a large upload before reading it) would be buffered in the queue unboundedly.
    if (bodyController.desiredSize != null && bodyController.desiredSize <= 0) {
      req.pause()
    }
  }

  function onEnd() {
    requestEnded = true
    closeBody()
  }

  function onError(error: Error) {
    markRequestAbortReason(error)
    abortBody(error)
  }

  function onAborted() {
    abortBody(createRequestAbortError(), { keepErrorListener: true })
  }

  function onClose() {
    if (!requestEnded) abortBody(createRequestAbortError(), { keepErrorListener: true })
  }

  return new ReadableStream({
    start(controller) {
      bodyController = controller

      // Keep using `on` (not `once`) so late errors after an abort are absorbed by `bodyClosed`
      // instead of crashing the process as unhandled `'error'` events.
      req.on('error', onError)

      if (isRequestAlreadyAborted(req)) {
        abortBody(createRequestAbortError(), { keepErrorListener: true })
        return
      }

      req.on('data', onData)
      req.on('end', onEnd)
      req.on('aborted', onAborted)
      req.on('close', onClose)

      if (isRequestAlreadyAborted(req)) {
        abortBody(createRequestAbortError(), { keepErrorListener: true })
      }
    },
    pull() {
      req.resume()
    },
    cancel() {
      cancelBody()
    },
  })
}

/**
 * Options for creating a `Request` from a Node.js incoming message.
 */
export type RequestOptions = Omit<RequestListenerOptions, 'onError'>

/**
 * Creates a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) object from
 *
 * - a [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse) pair
 * - a [`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest)/[`http2.Http2ServerResponse`](https://nodejs.org/api/http2.html#class-http2http2serverresponse) pair
 *
 * @param req The incoming request object
 * @param res The server response object
 * @param options Options for creating the request
 * @returns A `Request` object
 * @throws If the request path contains a literal backslash, the effective host is invalid, or
 * HTTP/2 `Host` and `:authority` values identify different hosts
 */
export function createRequest(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse,
  options?: RequestOptions,
): Request {
  let lifecycle = createRequestLifecycle()
  let request = createRequestWithLifecycle(req, options, lifecycle)
  observeResponseForRequestLifecycle(res, lifecycle)
  return request
}

function createRequestWithLifecycle(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  options: RequestOptions | undefined,
  lifecycle: RequestLifecycle,
): Request {
  validateRequestTarget(req)

  let method = req.method ?? 'GET'
  let protocol = getRequestProtocol(req, options)
  let host = getRequestHost(req, options)
  let url = `${protocol}//${host}${req.url}`

  let init: RequestInit = {
    method,
    headers: createHeadersInit(req),
    signal: lifecycle.signal,
  }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = createRequestBodyStream(req, lifecycle)

    // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
    // However, this property is not defined in the TypeScript types for RequestInit, so we have
    // to cast it here in order to set it without a type error.
    // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
    ;(init as { duplex: 'half' }).duplex = 'half'
  }

  return new Request(url, init)
}

class RequestTargetError extends Error {}

function validateRequestTarget(req: http.IncomingMessage | http2.Http2ServerRequest): void {
  // Validate the incoming path before Web URL parsing normalizes backslashes into forward slashes.
  let url = req.url
  if (url === undefined) return
  let backslashIndex = url.indexOf('\\')
  if (backslashIndex === -1) return
  let queryIndex = url.indexOf('?')
  if (queryIndex === -1 || backslashIndex < queryIndex) {
    throw new RequestTargetError('Invalid request target: backslash in path')
  }
}

function getRequestProtocol(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  options?: RequestOptions,
): string {
  return (
    options?.protocol ??
    (options?.trustProxy ? getForwardedProtocol(req.headers) : undefined) ??
    ('encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:')
  )
}

function createClientAddress(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  options?: RequestOptions,
): ClientAddress {
  let forwardedClient = options?.trustProxy ? getForwardedClientAddress(req.headers) : undefined

  return {
    address: forwardedClient?.address ?? req.socket.remoteAddress ?? '',
    family: forwardedClient?.family ?? (req.socket.remoteFamily as ClientAddress['family']),
    port: forwardedClient?.port ?? req.socket.remotePort!,
  }
}

function getRequestHost(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  options?: RequestOptions,
): string {
  let authority = getRequestAuthority(req)

  let host =
    options?.host ??
    (options?.trustProxy ? getForwardedHost(req.headers) : undefined) ??
    authority ??
    getHeaderValue(req.headers, 'host') ??
    'localhost'

  validateRequestAuthority(host)
  return host
}

class RequestAuthorityError extends Error {}

function validateRequestAuthority(authority: string): void {
  if (!isValidSimpleAuthority(authority)) {
    parseRequestAuthority(authority)
  }
}

// Fast path for standard ASCII hostnames and canonical dotted-quad IPv4 addresses with an optional
// port (up to 253 DNS chars + `:65535` = 259). Any non-trivial authority (IPv6, punycode, trailing
// dot, non-canonical numeric host, longer host, or invalid input) falls back to
// `parseRequestAuthority()` so WHATWG URL validation stays exact.
function isValidSimpleAuthority(authority: string): boolean {
  let len = authority.length
  if (len === 0 || len > 259) return false

  let hostEnd = len
  let colonIndex = authority.lastIndexOf(':')
  if (colonIndex !== -1) {
    if (authority.indexOf(':') !== colonIndex || colonIndex === 0 || colonIndex === len - 1) {
      return false
    }
    let port = 0
    for (let i = colonIndex + 1; i < len; i++) {
      let digit = authority.charCodeAt(i) - 48
      if (digit < 0 || digit > 9) return false
      port = port * 10 + digit
    }
    if (port > 65_535) return false
    hostEnd = colonIndex
  }

  let labelStart = 0
  let hasAlpha = false
  let lastLabelHasAlphaOrHyphen = false
  let dotCount = 0

  for (let i = 0; i < hostEnd; i++) {
    let code = authority.charCodeAt(i)
    if (code === 46) {
      if (i === labelStart) return false
      dotCount++
      labelStart = i + 1
      lastLabelHasAlphaOrHyphen = false
    } else if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90)) {
      hasAlpha = true
      lastLabelHasAlphaOrHyphen = true
    } else if (code >= 48 && code <= 57) {
      // ASCII digit
    } else if (code === 45) {
      // Defer punycode labels (`xn--`) and leading/trailing hyphens to `URL.parse()`.
      if (i === labelStart || i + 1 === hostEnd || authority.charCodeAt(i + 1) === 46) {
        return false
      }
      if (i - labelStart === 2 && authority.charCodeAt(i + 1) === 45) {
        return false
      }
      lastLabelHasAlphaOrHyphen = true
    } else {
      return false
    }
  }

  if (labelStart === hostEnd) return false

  if (hasAlpha) {
    if (!lastLabelHasAlphaOrHyphen) return false
    // Defer hex-like last labels (`0x...`) so WHATWG's "ends in a number" rule is handled by
    // `URL.parse()`.
    if (authority.charCodeAt(labelStart) === 48 && labelStart + 1 < hostEnd) {
      let second = authority.charCodeAt(labelStart + 1)
      if (second === 120 || second === 88) return false
    }
    return true
  }

  // Canonical dotted-quad IPv4 (four decimal octets 0..255 with no leading zeros).
  if (dotCount !== 3) return false
  let octet = 0
  let octetLen = 0
  for (let i = 0; i <= hostEnd; i++) {
    if (i === hostEnd || authority.charCodeAt(i) === 46) {
      if (octetLen === 0 || octet > 255) return false
      octet = 0
      octetLen = 0
    } else {
      let digit = authority.charCodeAt(i) - 48
      if (digit < 0 || digit > 9) return false
      if (octetLen === 1 && octet === 0) return false
      octet = octet * 10 + digit
      octetLen++
    }
  }

  return true
}

function parseRequestAuthority(authority: string, protocol = 'http:'): URL {
  // Require an authority rather than a complete URL.
  if (/[/\\?#@\s\p{Cc}]/u.test(authority)) {
    throw new RequestAuthorityError('Invalid request authority')
  }

  let url = URL.parse(`${protocol}//${authority}`)
  if (url == null || url.hostname === '') {
    throw new RequestAuthorityError('Invalid request authority')
  }

  return url
}

function getRequestAuthority(
  req: http.IncomingMessage | http2.Http2ServerRequest,
): string | undefined {
  let value = req.headers[':authority']
  let authority = Array.isArray(value) ? value[0] : value
  let host = req.headers.host

  if (authority != null && host != null) {
    // Compare using the incoming scheme, before deployment overrides are applied.
    let scheme = req.headers[':scheme']
    let protocol =
      (Array.isArray(scheme) ? scheme[0] : scheme) ??
      ('encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http')
    let authorityUrl = parseRequestAuthority(authority, `${protocol}:`)
    let hostUrl = parseRequestAuthority(host, `${protocol}:`)

    if (authorityUrl.host !== hostUrl.host) {
      throw new RequestAuthorityError('Host header does not match :authority')
    }
  }

  return authority
}

function getHeaderValue(
  headers: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
  name: string,
): string | undefined {
  let value = headers[name]
  if (value == null) return undefined
  return Array.isArray(value) ? value.join(', ') : value
}

function getForwardedProtocol(
  headers: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
): string | undefined {
  return (
    normalizeForwardedProtocol(
      getForwardedHeaderParameter(getHeaderValue(headers, 'forwarded'), 'proto'),
    ) ?? getXForwardedProtoHeaderProtocol(getHeaderValue(headers, 'x-forwarded-proto'))
  )
}

function getForwardedHost(
  headers: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
): string | undefined {
  return (
    normalizeForwardedHost(
      getForwardedHeaderParameter(getHeaderValue(headers, 'forwarded'), 'host'),
    ) ?? normalizeForwardedHost(getFirstHeaderValue(getHeaderValue(headers, 'x-forwarded-host')))
  )
}

interface ForwardedClientAddress {
  address: string
  family: ClientAddress['family']
  port?: number
}

function getForwardedClientAddress(
  headers: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
): ForwardedClientAddress | undefined {
  return (
    normalizeForwardedClientAddress(
      getForwardedHeaderParameter(getHeaderValue(headers, 'forwarded'), 'for'),
    ) ??
    normalizeForwardedClientAddress(getFirstHeaderValue(getHeaderValue(headers, 'x-forwarded-for')))
  )
}

function getForwardedHeaderParameter(
  value: string | undefined,
  parameterName: string,
): string | undefined {
  if (value == null) return undefined

  for (let element of splitHeaderValue(value, ',')) {
    for (let parameter of splitHeaderValue(element, ';')) {
      let index = parameter.indexOf('=')
      if (index === -1) continue

      let name = parameter.slice(0, index).trim().toLowerCase()
      if (name !== parameterName) continue

      return unquoteHeaderValue(parameter.slice(index + 1).trim())
    }
  }

  return undefined
}

function getXForwardedProtoHeaderProtocol(value: string | undefined): string | undefined {
  return normalizeForwardedProtocol(getFirstHeaderValue(value))
}

function getFirstHeaderValue(value: string | undefined): string | undefined {
  if (value == null) return undefined

  let firstValue = splitHeaderValue(value, ',')[0]
  return firstValue == null ? undefined : unquoteHeaderValue(firstValue.trim())
}

function normalizeForwardedProtocol(value: string | undefined): string | undefined {
  if (value == null) return undefined

  let protocol = value.trim().toLowerCase()
  if (protocol.endsWith(':')) protocol = protocol.slice(0, -1)

  return protocol === 'http' || protocol === 'https' ? `${protocol}:` : undefined
}

function normalizeForwardedHost(value: string | undefined): string | undefined {
  if (value == null) return undefined

  let host = value.trim()
  return host === '' ? undefined : host
}

function normalizeForwardedClientAddress(
  value: string | undefined,
): ForwardedClientAddress | undefined {
  if (value == null) return undefined

  let input = value.trim()
  if (input === '' || input.toLowerCase() === 'unknown' || input.startsWith('_')) {
    return undefined
  }

  let address = input
  let port: number | undefined

  if (address.startsWith('[')) {
    let end = address.indexOf(']')
    if (end === -1) return undefined

    let portInput = address.slice(end + 1)
    address = address.slice(1, end)
    port = parseForwardedPort(portInput)
  } else {
    let colonIndex = address.lastIndexOf(':')
    if (colonIndex !== -1 && address.indexOf(':') === colonIndex) {
      port = parseForwardedPort(address.slice(colonIndex))
      if (port !== undefined) address = address.slice(0, colonIndex)
    }
  }

  let version = net.isIP(address)
  if (version === 4) return { address, family: 'IPv4', port }
  if (version === 6) return { address, family: 'IPv6', port }
  return undefined
}

function parseForwardedPort(value: string): number | undefined {
  if (!value.startsWith(':')) return undefined

  let port = Number(value.slice(1))
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : undefined
}

function splitHeaderValue(value: string, delimiter: ',' | ';'): string[] {
  let parts: string[] = []
  let start = 0
  let quoted = false
  let escaped = false

  for (let index = 0; index < value.length; index++) {
    let char = value[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (quoted && char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (!quoted && char === delimiter) {
      parts.push(value.slice(start, index))
      start = index + 1
    }
  }

  parts.push(value.slice(start))
  return parts
}

function unquoteHeaderValue(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value

  let unquoted = ''
  for (let index = 1; index < value.length - 1; index++) {
    let char = value[index]

    if (char === '\\' && index + 1 < value.length - 1) {
      index++
      unquoted += value[index]
    } else {
      unquoted += char
    }
  }

  return unquoted
}

function createHeadersInit(
  req: http.IncomingMessage | http2.Http2ServerRequest,
): Record<string, string> {
  let raw = req.headers

  // On HTTP/1.x, `req.headers` has no pseudo-headers and usually only string values.
  if (req.httpVersionMajor === 1) {
    let canReuse = true
    for (let key in raw) {
      if (!Object.hasOwn(raw, key)) continue
      if (typeof raw[key] !== 'string' || key.charCodeAt(0) === 58) {
        canReuse = false
        break
      }
    }
    if (canReuse) return raw as Record<string, string>
  }

  let headers: Record<string, string> = Object.create(null)
  for (let key in raw) {
    if (!Object.hasOwn(raw, key) || key.charCodeAt(0) === 58) continue
    let value = raw[key]
    if (value == null) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return headers
}

/**
 * Creates a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object from the headers in a Node.js
 * [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest).
 *
 * @param req The incoming request object
 * @returns A `Headers` object
 */
export function createHeaders(req: http.IncomingMessage | http2.Http2ServerRequest): Headers {
  return new Headers(createHeadersInit(req))
}

/**
 * Sends a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) to the client using a Node.js
 * [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)/[`http2.Http2ServerResponse`](https://nodejs.org/api/http2.html#class-http2http2serverresponse)
 * object.
 *
 * @param res The server response object
 * @param response The response to send
 */
export async function sendResponse(
  res: http.ServerResponse | http2.Http2ServerResponse,
  response: Response,
): Promise<void> {
  await writeResponse(res, response)
}

async function writeResponse(
  res: http.ServerResponse | http2.Http2ServerResponse,
  response: Response,
  lifecycle?: RequestLifecycle,
): Promise<void> {
  // Iterate over response.headers so we are sure to send multiple Set-Cookie headers correctly.
  // These would incorrectly be merged into a single header if we tried to use
  // `Object.fromEntries(response.headers.entries())`.
  let headers: Record<string, string | string[]> = {}
  for (let [key, value] of response.headers) {
    if (Object.hasOwn(headers, key)) {
      let existing = headers[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        headers[key] = [existing, value]
      }
    } else {
      headers[key] = value
    }
  }

  if (res.req.httpVersionMajor === 1) {
    ;(res as http.ServerResponse).writeHead(response.status, response.statusText, headers)
  } else {
    // HTTP/2 doesn't support status messages
    // https://datatracker.ietf.org/doc/html/rfc7540#section-8.1.2.4
    //
    // HTTP2 `res.writeHead()` will safely ignore the statusText parameter, but
    // it will emit a warning which we want to avoid.
    // https://nodejs.org/docs/latest-v22.x/api/http2.html#responsewriteheadstatuscode-statusmessage-headers
    ;(res as http2.Http2ServerResponse).writeHead(response.status, headers)
  }

  if (response.body != null && res.req.method !== 'HEAD') {
    let reader = response.body.getReader()
    let responseClosed = lifecycle?.closed ?? false
    let cancelBody: (() => void) | undefined

    if (lifecycle !== undefined) {
      if (lifecycle.closed) {
        void reader.cancel().catch(() => undefined)
        return
      }
      lifecycle.setResponseReader(reader)
    } else {
      cancelBody = () => {
        responseClosed = true
        void reader.cancel().catch(() => undefined)
      }
      res.once('close', cancelBody)
    }

    // Don't call `reader.releaseLock()` after consuming the body: `sendResponse` is the terminal
    // consumer, and Node's WHATWG stream implementation allocates a `TypeError` with a stack trace
    // on every `releaseLock()` call.
    try {
      while (!(lifecycle?.closed ?? responseClosed)) {
        let result = await reader.read()
        if (result.done) break

        // @ts-expect-error - Node typings for http2 require a 2nd parameter to write but it's optional
        if (res.write(result.value) === false) {
          await waitForDrainOrClose(res)
          if ((lifecycle?.closed ?? responseClosed) || res.destroyed) {
            void reader.cancel().catch(() => undefined)
            return
          }
        }
      }
    } finally {
      if (lifecycle !== undefined) {
        lifecycle.setResponseReader(undefined)
      } else if (cancelBody !== undefined) {
        res.removeListener('close', cancelBody)
      }
    }

    if (lifecycle?.closed ?? responseClosed) return
  }

  res.end()
}

async function waitForDrainOrClose(
  res: http.ServerResponse | http2.Http2ServerResponse,
): Promise<void> {
  if (res.destroyed) return

  await new Promise<void>((resolve) => {
    function cleanup() {
      res.removeListener('close', onClose)
      res.removeListener('drain', onDrain)
    }

    function onClose() {
      cleanup()
      resolve()
    }

    function onDrain() {
      cleanup()
      resolve()
    }

    res.once('close', onClose)
    res.once('drain', onDrain)
  })
}
