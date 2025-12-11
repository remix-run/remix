import type { RoutePattern } from '@remix-run/route-pattern'

import { Route } from '../route-map.ts'

/**
 * Shorthand for a DELETE route.
 *
 * @alias del
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for DELETE requests
 */
export function createDeleteRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'DELETE', source> {
  return new Route('DELETE', pattern)
}

/**
 * Shorthand for a GET route.
 *
 * @alias get
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for GET requests
 */
export function createGetRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'GET', source> {
  return new Route('GET', pattern)
}

/**
 * Shorthand for a HEAD route.
 *
 * @alias head
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for HEAD requests
 */
export function createHeadRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'HEAD', source> {
  return new Route('HEAD', pattern)
}

/**
 * Shorthand for a OPTIONS route.
 *
 * @alias options
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for OPTIONS requests
 */
export function createOptionsRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'OPTIONS', source> {
  return new Route('OPTIONS', pattern)
}

/**
 * Shorthand for a PATCH route.
 *
 * @alias patch
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for PATCH requests
 */
export function createPatchRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'PATCH', source> {
  return new Route('PATCH', pattern)
}

/**
 * Shorthand for a POST route.
 *
 * @alias post
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for POST requests
 */
export function createPostRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'POST', source> {
  return new Route('POST', pattern)
}

/**
 * Shorthand for a PUT route.
 *
 * @alias put
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for PUT requests
 */
export function createPutRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'PUT', source> {
  return new Route('PUT', pattern)
}
