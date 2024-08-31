import * as http from 'node:http';

/**
 * Returns the origin of an incoming request URL.
 */
export function getRequestOrigin(req: http.IncomingMessage): string {
  let protocol = 'encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:';
  let host = req.headers.host ?? 'localhost';
  return `${protocol}//${host}`;
}

export interface ClientAddr {
  /**
   * The IP address of the client that sent the request.
   *
   * [Node.js Reference](https://nodejs.org/api/net.html#socketremoteaddress)
   */
  address?: string;
  /**
   * The family of the IP address of the client that sent the request. Either `'IPv4'` or `'IPv6'`.
   *
   * [Node.js Reference](https://nodejs.org/api/net.html#socketremotefamily)
   */
  family?: string;
  /**
   * The numeric representation of the remote port of the client that sent the request.
   *
   * [Node.js Reference](https://nodejs.org/api/net.html#socketremoteport)
   */
  port?: number;
}

/**
 * A function that handles an error that occurred during request handling. May return a response to
 * send to the client, or `undefined` to allow the server to send a default error response.
 *
 * [MDN `Response` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 */
export interface ErrorHandler {
  (error: unknown): Response | void | Promise<Response | void>;
}

/**
 * A function that handles an incoming request and returns a response.
 *
 * [MDN `Request` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Request)
 *
 * [MDN `Response` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 */
export interface FetchHandler {
  (request: Request, client: ClientAddr): Response | Promise<Response>;
}

export interface RequestListenerOptions {
  /**
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
   */
  onError?: ErrorHandler;
  /**
   * Overrides the origin of the incoming request URL. By default the request URL origin is derived
   * from the `Host` header and the connection protocol.
   */
  origin?: string;
}

/**
 * Wraps a `RequestHandler` function in a Node.js `http.RequestListener` that can be used with
 * `http.createServer()` or `https.createServer()`.
 *
 * ```ts
 * import * as http from 'node:http';
 * import { type RequestHandler, createRequestListener } from '@mjackson/node-fetch-server';
 *
 * let handler: RequestHandler = async (request) => {
 *   return new Response('Hello, world!');
 * };
 *
 * let server = http.createServer(
 *   createRequestListener(handler)
 * );
 *
 * server.listen(3000);
 * ```
 */
export function createRequestListener(
  handler: FetchHandler,
  options?: RequestListenerOptions,
): http.RequestListener {
  let onError = options?.onError ?? defaultErrorHandler;

  return async (req, res) => {
    let origin = options?.origin ?? getRequestOrigin(req);
    let url = new URL(req.url!, origin);
    let request = createRequest(req, res, url);
    let client: ClientAddr = {
      address: req.socket.remoteAddress,
      family: req.socket.remoteFamily,
      port: req.socket.remotePort,
    };

    try {
      let response = await handler(request, client);
      await sendResponse(res, response);
    } catch (error) {
      try {
        let response = await onError(error);
        await sendResponse(res, response ?? internalServerError());
      } catch (error) {
        console.error(`There was an error in the error handler: ${error}`);
        await sendResponse(res, internalServerError());
      }
    }
  };
}

function defaultErrorHandler(error: unknown): Response {
  console.error(error);
  return internalServerError();
}

function internalServerError(): Response {
  return new Response('Internal Server Error', {
    status: 500,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

function createRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Request {
  let controller = new AbortController();
  res.on('close', () => {
    controller.abort();
  });

  let init: RequestInit = {
    method: req.method,
    headers: createHeaders(req.headers),
    signal: controller.signal,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = createBody(req);

    // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
    // However, this property is not defined in the TypeScript types for RequestInit, so we have
    // to cast it here in order to set it without a type error.
    // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
    (init as { duplex: 'half' }).duplex = 'half';
  }

  return new Request(url, init);
}

function createHeaders(incoming: http.IncomingHttpHeaders): Headers {
  let headers = new Headers();

  for (let key in incoming) {
    let value = incoming[key];

    if (Array.isArray(value)) {
      for (let v of value) {
        headers.append(key, v);
      }
    } else if (value != null) {
      headers.set(key, value);
    }
  }

  return headers;
}

function createBody(req: http.IncomingMessage): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      req.on('data', (chunk) => {
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });

      req.on('end', () => {
        controller.close();
      });
    },
  });
}

async function sendResponse(res: http.ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;

  for (let [name, value] of response.headers.entries()) {
    res.setHeader(name, value);
  }

  res.flushHeaders();

  if (response.body != null) {
    for await (let chunk of response.body) {
      res.write(chunk);
    }
  }

  res.end();
}
