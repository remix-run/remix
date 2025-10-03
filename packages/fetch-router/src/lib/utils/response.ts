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
