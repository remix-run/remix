/**
 * A helper for working with JSON [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)s.
 *
 * @param body The body of the response.
 * @param init (optional) The `ResponseInit` object for the response.
 * @returns A `Response` object with a JSON body and the appropriate `Content-Type` header.
 */
export function json(body: any, init?: ResponseInit): Response {
  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=UTF-8')
  }

  return new Response(JSON.stringify(body), { ...init, headers })
}
