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
 * Handles request construction, handler, or response body errors before headers are sent. May
 * return a response to send to the client, or `undefined` for the default error response. Response
 * body failures after headers are sent close the connection.
 *
 * [MDN `Response` Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 *
 * @param error The error that was thrown
 * @returns A response to send to the client, or `undefined` for the default error response
 */
export interface ErrorHandler {
  /**
   * Handles a thrown request-processing error and may return a custom response.
   */
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
  /**
   * Handles an incoming request and returns the response sent to the client.
   */
  (request: Request, client: ClientAddress): Response | Promise<Response>
}
