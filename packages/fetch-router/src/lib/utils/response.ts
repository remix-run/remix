import type { HrefBuilderArgs } from '@remix-run/route-pattern'

import type { Route } from '../route-map.ts'

/**
 * Creates an HTML Response with proper Content-Type header.
 *
 * @param body The body of the response
 * @param init Optional response initialization options
 * @returns A Response with HTML content-type header and the given body
 */
export function html(body: BodyInit, init?: ResponseInit): Response {
  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(body, { ...init, headers })
}

/**
 * Creates a JSON response with the given body and status code.
 *
 * @param body The body of the response, which will be `JSON.stringify`d
 * @param init Optional response initialization options
 * @returns A Response with JSON content-type header and the given body
 */
export function json(body: any, init?: ResponseInit): Response {
  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=UTF-8')
  }

  return new Response(JSON.stringify(body), { ...init, headers })
}

/**
 * Creates a redirect response with the given location and status code.
 *
 * Note: This improves upon `Response.redirect()` in the following ways:
 * - It accepts a `ResponseInit` object for fine-grained control over the response
 * - It accepts a Route object for type-safe redirects
 * - It accepts a relative URL for the location, which most HTTP clients
 *   will resolve against the base URL of the request
 *
 * @param location The location to redirect to (string or Route with no required params)
 * @param status The status code to redirect with, or a `ResponseInit` object. Defaults to `302`
 * @returns A Response that redirects to the given location
 */
export function redirect<P extends string>(
  location: string | RouteWithNoRequiredParams<P>,
  status: number | ResponseInit = 302,
): Response {
  let init: ResponseInit | undefined
  if (typeof status !== 'number') {
    init = status
    status = 302
  }

  let href = typeof location === 'string' ? location : location.href()

  let headers = new Headers(init?.headers)
  if (!headers.has('Location')) {
    headers.set('Location', href)
  }

  return new Response(null, { status, ...init, headers })
}

/**
 * Type constraint for Routes that have no required parameters.
 * This ensures that calling `.href()` won't throw due to missing params.
 */
type RouteWithNoRequiredParams<P extends string> = Route<'GET' | 'ANY', P> & {
  href: [] extends HrefBuilderArgs<P> ? () => string : never
}
