/**
 * Creates an HTML Response with proper Content-Type header.
 *
 * @param body The body of the response
 * @param init Optional response initialization options
 * @returns A Response with HTML content-type header and the given body
 */
export function html(body: BodyInit, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      ...init?.headers,
    },
  })
}

/**
 * Creates a JSON response with the given body and status code.
 *
 * @param body The body of the response, which will be `JSON.stringify`d
 * @param init Optional response initialization options
 * @returns A Response with JSON content-type header and the given body
 */
export function json(body: any, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...init?.headers,
    },
  })
}

/**
 * Creates a redirect response with the given location and status code.
 *
 * Note: This improves upon `Response.redirect()` in two ways:
 * - It accepts a `ResponseInit` object for more control over the response
 * - It accepts a relative URL for the location, which most HTTP clients
 *   will resolve against the base URL of the request
 *
 * @param location The location to redirect to
 * @param status The status code to redirect with, or a `ResponseInit` object. Defaults to `302`
 * @returns A Response that redirects to the given location
 */
export function redirect(location: string, status: number | ResponseInit = 302): Response {
  let init: ResponseInit | undefined
  if (typeof status !== 'number') {
    init = status
    status = 302
  }

  return new Response(null, {
    status,
    ...init,
    headers: {
      Location: location,
      ...init?.headers,
    },
  })
}
