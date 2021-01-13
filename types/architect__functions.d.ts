declare module "@architect/functions" {
  /**
   * Requests are passed to your handler function in an object, and include the following parameters
   */

  export interface Request {
    /**
     * Payload version (e.g. 2.0)
     */
    version: string;

    /**
     * Tuple of HTTP method (GET, POST, PATCH, PUT, or DELETE) and path; URL
     * params are surrounded in braces If path is not captured by a specific
     * function, routeKey will be $default (and be handled by the get / function)
     *
     * Example: GET /, GET /shop/{product}
     */
    routeKey: string;

    /**
     * The absolute path of the request
     *
     * Example: /, /shop/chocolate-chip-cookies
     */
    rawPath: string;

    /**
     * Any URL params, if defined in your HTTP function's path (e.g. product in /shop/:product)
     *
     * Example: { product: 'chocolate-chip-cookies' }
     */
    pathParameters?: { [param: string]: string };

    /**
     * String containing query string params of request, if any
     *
     * Example: ?someParam=someValue, '' (if none)
     */
    rawQueryString: string;

    /**
     * Any query params if present in the client request
     *
     * Example: { someParam: someValue }
     */
    queryStringParameters?: { [param: string]: string };

    /**
     * Array containing all cookies, if present in client request
     *
     * Example: [ 'some_cookie_name=some_cookie_value' ]
     */
    cookies?: string[];

    /**
     * All client request headers
     *
     * Example: { 'accept-encoding': 'gzip' }
     */
    headers: { [header: string]: string };

    /**
     * Request metadata, including http object containing method and path (should
     * you not want to parse the routeKey)
     */
    requestContext: {
      http: {
        method: string;
        path: string;
        routeKey: string;
      };
    };

    /**
     * Contains unparsed, base64-encoded request body
     * We suggest parsing with a body parser helper
     */
    body?: string;

    /**
     * Indicates whether body is base64-encoded binary payload
     */
    isBase64Encoded: boolean;
  }

  export interface Response {
    /**
     * Sets the HTTP status code; usually to 200
     */
    statusCode: number;

    /**
     * All response headers
     */
    headers?: { [header: string]: string };

    /**
     * Contains response body, either as a plain string, or, if binary, a
     * base64-encoded buffer
     *
     * Note: The maximum body payload size is 6MB; files being delivered
     * non-dynamically should use the Begin CDN
     */
    body?: string;

    /**
     * Indicates whether body is base64-encoded binary payload; defaults to false
     *
     * Required to be set to true if emitting a binary payload
     */
    isBase64Encoded?: boolean;
  }

  // There's a lot more, but this is all we use
  export interface Arc {
    http: Http;
  }

  type session = { [key: string]: string };

  interface Http {
    session: {
      write: (session: session) => Promise<string>;
      read: (request: Request) => Promise<session>;
    };
  }

  const arc: Arc;

  export default arc;
}
