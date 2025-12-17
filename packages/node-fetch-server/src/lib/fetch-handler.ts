/**
 * Information about the client that sent a request.
 */
export interface ClientAddress {
  /**
   * The IP address of the client that sent the request.
   *
   * [Node.js Reference](https://nodejs.org/api/net.html#socketremoteaddress)
   */
  address: string
  /**
   * The family of the client IP address.
   *
   * [Node.js Reference](https://nodejs.org/api/net.html#socketremotefamily)
   */
  family: 'IPv4' | 'IPv6'
  /**
   * The remote port of the client that sent the request.
   *
   * [Node.js Reference](https://nodejs.org/api/net.html#socketremoteport)
   */
  port: number
}

/**
 * A function that handles an error that occurred during request handling. May return a response to
 * send to the client, or `undefined` to allow the server to send a default error response.
 *
 * [MDN `Response` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 *
 * @param error The error that was thrown
 * @returns A response to send to the client, or `undefined` for the default error response
 */
export interface ErrorHandler {
  (error: unknown): void | Response | Promise<void | Response>
}

/**
 * A function that handles an incoming request and returns a response.
 *
 * [MDN `Request` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Request)
 *
 * [MDN `Response` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 *
 * @param request The incoming request
 * @param client Information about the client that sent the request
 * @returns A response to send to the client
 */
export interface FetchHandler {
  (request: Request, client: ClientAddress): Response | Promise<Response>
}
