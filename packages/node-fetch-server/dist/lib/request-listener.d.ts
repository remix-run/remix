import type * as http from 'node:http';
import type * as http2 from 'node:http2';
import type { ErrorHandler, FetchHandler } from './fetch-handler.ts';
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
 * import { createRequestListener } from '@remix-run/node-fetch-server';
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
export declare function createRequestListener(handler: FetchHandler, options?: RequestListenerOptions): http.RequestListener;
/**
 * Options for creating a `Request` from a Node.js incoming message.
 */
export type RequestOptions = Omit<RequestListenerOptions, 'onError'>;
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
export declare function createRequest(req: http.IncomingMessage | http2.Http2ServerRequest, res: http.ServerResponse | http2.Http2ServerResponse, options?: RequestOptions): Request;
/**
 * Creates a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object from the headers in a Node.js
 * [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)/[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#class-http2http2serverrequest).
 *
 * @param req The incoming request object
 * @returns A `Headers` object
 */
export declare function createHeaders(req: http.IncomingMessage | http2.Http2ServerRequest): Headers;
/**
 * Sends a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) to the client using a Node.js
 * [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)/[`http2.Http2ServerResponse`](https://nodejs.org/api/http2.html#class-http2http2serverresponse)
 * object.
 *
 * @param res The server response object
 * @param response The response to send
 */
export declare function sendResponse(res: http.ServerResponse | http2.Http2ServerResponse, response: Response): Promise<void>;
//# sourceMappingURL=request-listener.d.ts.map