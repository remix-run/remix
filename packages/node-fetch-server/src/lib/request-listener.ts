import type * as http from 'node:http'
import type * as http2 from 'node:http2'

import type { ClientAddress, ErrorHandler, FetchHandler } from './fetch-handler.ts'
import { readStream } from './read-stream.ts'

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

  return async (req, res) => {
    let request = createRequest(req, res, options)
    let client = {
      address: req.socket.remoteAddress!,
      family: req.socket.remoteFamily! as ClientAddress['family'],
      port: req.socket.remotePort!,
    }

    let response: Response
    try {
      response = await handler(request, client)
    } catch (error) {
      try {
        response = (await onError(error)) ?? internalServerError()
      } catch (error) {
        console.error(`There was an error in the error handler: ${error}`)
        response = internalServerError()
      }
    }

    await sendResponse(res, response)
  }
}

function defaultErrorHandler(error: unknown): Response {
  console.error(error)
  return internalServerError()
}

function internalServerError(): Response {
  return new Response(
    // "Internal Server Error"
    new Uint8Array([
      73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111,
      114,
    ]),
    {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    },
  )
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
  let controller: AbortController | null = new AbortController()

  // Abort once we can no longer write a response if we have
  // not yet sent a response (i.e., `close` without `finish`)
  // `finish` -> done rendering the response
  // `close` -> response can no longer be written to
  res.once('close', () => controller?.abort())
  res.once('finish', () => (controller = null))

  let method = req.method ?? 'GET'
  let headers = createHeaders(req)

  let protocol =
    options?.protocol ?? ('encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:')
  let host = options?.host ?? headers.get('Host') ?? req.headers[':authority'] ?? 'localhost'
  let url = new URL(req.url!, `${protocol}//${host}`)

  let init: RequestInit = { method, headers, signal: controller.signal }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = new ReadableStream({
      start(controller) {
        req.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength))
        })
        req.on('end', () => {
          controller.close()
        })
      },
    })

    // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
    // However, this property is not defined in the TypeScript types for RequestInit, so we have
    // to cast it here in order to set it without a type error.
    // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
    ;(init as { duplex: 'half' }).duplex = 'half'
  }

  return new Request(url, init)
}

/**
 * Creates a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object from the headers in a Node.js
 * [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest).
 *
 * @param req The incoming request object
 * @returns A `Headers` object
 */
export function createHeaders(req: http.IncomingMessage | http2.Http2ServerRequest): Headers {
  let headers = new Headers()

  let rawHeaders = req.rawHeaders
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i].startsWith(':')) continue
    headers.append(rawHeaders[i], rawHeaders[i + 1])
  }

  return headers
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
    for await (let chunk of readStream(response.body)) {
      // @ts-expect-error - Node typings for http2 require a 2nd parameter to write but it's optional
      if (res.write(chunk) === false) {
        await new Promise<void>((resolve) => {
          res.once('drain', resolve)
        })
      }
    }
  }

  res.end()
}
