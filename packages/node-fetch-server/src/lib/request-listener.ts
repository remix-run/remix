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

// "Internal Server Error"
const internalServerErrorBody = [
  73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111, 114,
]

/**
 * Options for creating a Node.js request listener.
 */
export interface RequestListenerOptions {
  /**
   * Overrides the host portion of the incoming request URL. By default the request URL host is
   * derived from the HTTP `Host` header.
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
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
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
  handler: FetchHandler,
  options?: RequestListenerOptions,
): http.RequestListener {
  let onError = options?.onError ?? defaultErrorHandler

  if (handler.length === 0) {
    let handlerWithoutArgs = handler as () => Response | Promise<Response>

    return async (_req, res) => {
      let isResponseClosed = observeResponseClose(res)
      let response: Response
      try {
        response = await handlerWithoutArgs()
      } catch (error) {
        response = await createErrorResponse(onError, error)
      }

      await sendResponseIfOpen(res, response, isResponseClosed)
    }
  }

  if (handler.length === 1) {
    let requestHandler = handler as (request: Request) => Response | Promise<Response>

    return (req, res) => {
      let isResponseClosed = observeResponseClose(res)

      let request: Request
      try {
        request = createRequest(req, res, options)
      } catch (error) {
        void sendResponseForCreationError(res, onError, error, isResponseClosed)
        return
      }

      let response: Response | Promise<Response>
      try {
        response = requestHandler(request)
      } catch (error) {
        if (isRequestAbortError(request, error)) return
        void sendErrorResponseForRequest(res, request, onError, error, isResponseClosed)
        return
      }

      if (isPromiseLike(response)) {
        void response.then(
          (response) => {
            void sendResponseForRequest(res, response, request, onError, isResponseClosed)
          },
          (error) => {
            if (isRequestAbortError(request, error)) return
            void sendErrorResponseForRequest(res, request, onError, error, isResponseClosed)
          },
        )
      } else {
        void sendResponseForRequest(res, response, request, onError, isResponseClosed)
      }
    }
  }

  return async (req, res) => {
    let isResponseClosed = observeResponseClose(res)

    let request: Request
    try {
      request = createRequest(req, res, options)
    } catch (error) {
      await sendResponseForCreationError(res, onError, error, isResponseClosed)
      return
    }

    let client = createClientAddress(req, request.headers, options)

    let response: Response
    try {
      response = await handler(request, client)
    } catch (error) {
      if (isRequestAbortError(request, error)) return
      response = await createErrorResponse(onError, error)
    }

    await sendResponseForRequest(res, response, request, onError, isResponseClosed)
  }
}

function observeResponseClose(res: http.ServerResponse | http2.Http2ServerResponse): () => boolean {
  let responseClosed = false
  res.once('close', () => {
    responseClosed = true
  })
  return () => responseClosed || res.destroyed
}

async function sendResponseIfOpen(
  res: http.ServerResponse | http2.Http2ServerResponse,
  response: Response,
  isResponseClosed: () => boolean,
): Promise<void> {
  if (isResponseClosed()) return
  await sendResponse(res, response)
}

async function sendResponseForCreationError(
  res: http.ServerResponse | http2.Http2ServerResponse,
  onError: ErrorHandler,
  error: unknown,
  isResponseClosed: () => boolean,
): Promise<void> {
  let response = await createErrorResponse(onError, error)
  await sendResponseIfOpen(res, response, isResponseClosed)
}

async function sendErrorResponseForRequest(
  res: http.ServerResponse | http2.Http2ServerResponse,
  request: Request,
  onError: ErrorHandler,
  error: unknown,
  isResponseClosed: () => boolean,
): Promise<void> {
  let response = await createErrorResponse(onError, error)
  if (isResponseClosed() || request.signal.aborted || hasResponseStarted(res)) return
  await sendResponse(res, response)
}

async function sendResponseForRequest(
  res: http.ServerResponse | http2.Http2ServerResponse,
  response: Response,
  request: Request,
  onError: ErrorHandler,
  isResponseClosed: () => boolean,
): Promise<void> {
  if (isResponseClosed() || request.signal.aborted) return
  try {
    await sendResponse(res, response)
  } catch (error) {
    if (isResponseClosed()) return
    if (isRequestAbortError(request, error)) return
    if (hasResponseStarted(res)) {
      destroyResponse(res, error)
      void createErrorResponse(onError, error)
      return
    }
    await sendErrorResponseForRequest(res, request, onError, error, isResponseClosed)
  }
}

async function createErrorResponse(onError: ErrorHandler, error: unknown): Promise<Response> {
  try {
    return (await onError(error)) ?? internalServerError()
  } catch (error) {
    console.error(`There was an error in the error handler: ${error}`)
    return internalServerError()
  }
}

function defaultErrorHandler(error: unknown): Response {
  console.error(error)
  return internalServerError()
}

function internalServerError(): Response {
  return new Response(new Uint8Array(internalServerErrorBody), {
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

      req.once('error', onError)

      if (isRequestAlreadyAborted(req)) {
        abortBody(createRequestAbortError(), { keepErrorListener: true })
        return
      }

      req.on('data', onData)
      req.once('end', onEnd)
      req.once('aborted', onAborted)
      req.once('close', onClose)

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
 */
export function createRequest(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse,
  options?: RequestOptions,
): Request {
  let lifecycle = createRequestLifecycle()
  observeResponseForRequestLifecycle(res, lifecycle)

  let method = req.method ?? 'GET'
  let headers = createHeaders(req)

  let protocol = getRequestProtocol(req, headers, options)
  let host = getRequestHost(req, headers, options)
  let url = `${protocol}//${host}${req.url}`

  let init: RequestInit = { method, headers, signal: lifecycle.signal }

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

function getRequestProtocol(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  headers: Headers,
  options?: RequestOptions,
): string {
  return (
    options?.protocol ??
    (options?.trustProxy ? getForwardedProtocol(headers) : undefined) ??
    ('encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:')
  )
}

function createClientAddress(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  headers: Headers,
  options?: RequestOptions,
): ClientAddress {
  let forwardedClient = options?.trustProxy ? getForwardedClientAddress(headers) : undefined
  let address = forwardedClient?.address ?? req.socket.remoteAddress ?? ''

  return {
    address,
    family: getClientAddressFamily(address, req.socket.remoteFamily!),
    port: forwardedClient?.port ?? req.socket.remotePort!,
  }
}

function getClientAddressFamily(address: string, fallbackFamily: string): ClientAddress['family'] {
  let version = net.isIP(address)
  if (version === 4) return 'IPv4'
  if (version === 6) return 'IPv6'
  return fallbackFamily as ClientAddress['family']
}

function getRequestHost(
  req: http.IncomingMessage | http2.Http2ServerRequest,
  headers: Headers,
  options?: RequestOptions,
): string {
  let authority = req.headers[':authority']

  return (
    options?.host ??
    (options?.trustProxy ? getForwardedHost(headers) : undefined) ??
    headers.get('Host') ??
    (Array.isArray(authority) ? authority[0] : authority) ??
    'localhost'
  )
}

function getForwardedProtocol(headers: Headers): string | undefined {
  return (
    normalizeForwardedProtocol(getForwardedHeaderParameter(headers.get('Forwarded'), 'proto')) ??
    getXForwardedProtoHeaderProtocol(headers.get('X-Forwarded-Proto'))
  )
}

function getForwardedHost(headers: Headers): string | undefined {
  return (
    normalizeForwardedHost(getForwardedHeaderParameter(headers.get('Forwarded'), 'host')) ??
    normalizeForwardedHost(getFirstHeaderValue(headers.get('X-Forwarded-Host')))
  )
}

interface ForwardedClientAddress {
  address: string
  port?: number
}

function getForwardedClientAddress(headers: Headers): ForwardedClientAddress | undefined {
  return (
    normalizeForwardedClientAddress(getForwardedHeaderParameter(headers.get('Forwarded'), 'for')) ??
    normalizeForwardedClientAddress(getFirstHeaderValue(headers.get('X-Forwarded-For')))
  )
}

function getForwardedHeaderParameter(
  value: string | null,
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

function getXForwardedProtoHeaderProtocol(value: string | null): string | undefined {
  return normalizeForwardedProtocol(getFirstHeaderValue(value))
}

function getFirstHeaderValue(value: string | null): string | undefined {
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

  return net.isIP(address) === 0 ? undefined : { address, port }
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

/**
 * Creates a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object from the headers in a Node.js
 * [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest).
 *
 * @param req The incoming request object
 * @returns A `Headers` object
 */
export function createHeaders(req: http.IncomingMessage | http2.Http2ServerRequest): Headers {
  let headers: Record<string, string> = {}

  for (let [key, value] of Object.entries(req.headers)) {
    if (key.startsWith(':') || value == null) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }

  return new Headers(headers)
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
  // Iterate over response.headers so we are sure to send multiple Set-Cookie headers correctly.
  // These would incorrectly be merged into a single header if we tried to use
  // `Object.fromEntries(response.headers.entries())`.
  let headers: Record<string, string | string[]> = {}
  for (let [key, value] of response.headers) {
    if (key in headers) {
      if (Array.isArray(headers[key])) {
        headers[key].push(value)
      } else {
        headers[key] = [headers[key] as string, value]
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
    let responseClosed = false

    function cancelBody() {
      responseClosed = true
      void reader.cancel().catch(() => undefined)
    }

    res.once('close', cancelBody)

    try {
      while (!responseClosed) {
        let result = await reader.read()
        if (result.done) break

        // @ts-expect-error - Node typings for http2 require a 2nd parameter to write but it's optional
        if (res.write(result.value) === false) {
          await waitForDrainOrClose(res)
          if (responseClosed || res.destroyed) return
        }
      }
    } finally {
      res.removeListener('close', cancelBody)
      reader.releaseLock()
    }

    if (responseClosed) return
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
