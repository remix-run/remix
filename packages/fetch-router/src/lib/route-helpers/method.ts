import type { RoutePattern } from '@remix-run/route-pattern'

import { Route } from '../route-map.ts'

/**
 * Shorthand for a DELETE route.
 */
export function createDeleteRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'DELETE', source> {
  return new Route('DELETE', pattern)
}

/**
 * Shorthand for a GET route.
 */
export function createGetRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'GET', source> {
  return new Route('GET', pattern)
}

/**
 * Shorthand for a HEAD route.
 */
export function createHeadRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'HEAD', source> {
  return new Route('HEAD', pattern)
}

/**
 * Shorthand for a OPTIONS route.
 */
export function createOptionsRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'OPTIONS', source> {
  return new Route('OPTIONS', pattern)
}

/**
 * Shorthand for a PATCH route.
 */
export function createPatchRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'PATCH', source> {
  return new Route('PATCH', pattern)
}

/**
 * Shorthand for a POST route.
 */
export function createPostRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'POST', source> {
  return new Route('POST', pattern)
}

/**
 * Shorthand for a PUT route.
 */
export function createPutRoute<source extends string>(
  pattern: source | RoutePattern<source>,
): Route<'PUT', source> {
  return new Route('PUT', pattern)
}
