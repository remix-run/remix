import { isSafeHtml, type SafeHtml } from '@remix-run/html-template'

/**
 * A helper for working with HTML [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)s.
 *
 * @param body The body of the response.
 * @param init (optional) The `ResponseInit` object for the response.
 * @returns A `Response` object with a HTML body and the appropriate `Content-Type` header.
 */
export function html(body: BodyInit | SafeHtml, init?: ResponseInit): Response {
  let payload: BodyInit
  if (isSafeHtml(body)) {
    payload = String(body)
  } else {
    payload = body
  }

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(payload, { ...init, headers })
}
