import * as http from 'node:http';

import { ClientAddress, ErrorHandler, FetchHandler } from './fetch-handler.js';

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
  host?: string;
  /**
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
   */
  onError?: ErrorHandler;
  /**
   * Overrides the protocol of the incoming request URL. By default the request URL protocol is
   * derived from the connection protocol. So e.g. when serving over HTTPS (using
   * `https.createServer()`), the request URL will begin with `https:`.
   */
  protocol?: string;
}

/**
 * Wraps a fetch handler in a Node.js `http.RequestListener` that can be used with
 * `http.createServer()` or `https.createServer()`.
 *
 * ```ts
 * import * as http from 'node:http';
 * import { createRequestListener } from '@mjackson/node-fetch-server';
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
 * @param handler The fetch handler to use for processing incoming requests.
 * @param options Configuration options.
 * @returns A Node.js `http.RequestListener` that can be used with `http.createServer()` or `https.createServer()`.
 */
export function createRequestListener(
  handler: FetchHandler,
  options?: RequestListenerOptions,
): http.RequestListener {
  let onError = options?.onError ?? defaultErrorHandler;

  return async (req, res) => {
    let request = createRequest(req, options);
    let client = {
      address: req.socket.remoteAddress!,
      family: req.socket.remoteFamily! as ClientAddress['family'],
      port: req.socket.remotePort!,
    };

    let response: Response;
    try {
      response = await handler(request, client);
    } catch (error) {
      try {
        response = (await onError(error)) ?? internalServerError();
      } catch (error) {
        console.error(`There was an error in the error handler: ${error}`);
        response = internalServerError();
      }
    }

    await sendResponse(res, response);
  };
}

function defaultErrorHandler(error: unknown): Response {
  console.error(error);
  return internalServerError();
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
  );
}

export type RequestOptions = Omit<RequestListenerOptions, 'onError'>;

/**
 * Creates a `Request` object from an incoming Node.js request object.
 * @param req The incoming request object.
 * @param options
 * @returns A `Request` object.
 */
export function createRequest(req: http.IncomingMessage, options?: RequestOptions): Request {
  let controller = new AbortController();
  req.on('close', () => {
    controller.abort();
  });

  let method = req.method ?? 'GET';
  let headers = createHeaders(req.rawHeaders);

  let protocol =
    options?.protocol ?? ('encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:');
  let host = options?.host ?? headers.get('host') ?? 'localhost';
  let url = new URL(req.url!, `${protocol}//${host}`);

  let init: RequestInit = { method, headers, signal: controller.signal };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = new ReadableStream({
      start(controller) {
        req.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });
        req.on('end', () => {
          controller.close();
        });
      },
    });

    // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
    // However, this property is not defined in the TypeScript types for RequestInit, so we have
    // to cast it here in order to set it without a type error.
    // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
    (init as { duplex: 'half' }).duplex = 'half';
  }

  return new Request(url, init);
}

function createHeaders(rawHeaders: string[]): Headers {
  let headers = new Headers();

  for (let i = 0; i < rawHeaders.length; i += 2) {
    headers.append(rawHeaders[i], rawHeaders[i + 1]);
  }

  return headers;
}

/**
 * Sends a `Response` to the client using the Node.js response object.
 * @param res The server response object.
 * @param response The response to send.
 */
export async function sendResponse(res: http.ServerResponse, response: Response): Promise<void> {
  // Use the rawHeaders API and iterate over response.headers so we are sure to send multiple
  // Set-Cookie headers correctly. These would incorrectly be merged into a single header if we
  // tried to use `Object.fromEntries(response.headers.entries())`.
  let rawHeaders: string[] = [];
  for (let [key, value] of response.headers) {
    rawHeaders.push(key, value);
  }

  res.writeHead(response.status, rawHeaders);

  if (response.body != null && res.req.method !== 'HEAD') {
    for await (let chunk of response.body) {
      res.write(chunk);
    }
  }

  res.end();
}
