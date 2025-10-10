import type { RoutePattern } from '@remix-run/route-pattern'

/**
 * Shorthand for a DELETE route.
 */
export function createDelete<P extends string>(pattern: P | RoutePattern<P>) {
  return { method: 'DELETE', pattern };
}

/**
 * Shorthand for a GET route.
 */
export function createGet<P extends string>(pattern: P | RoutePattern<P>) {
  return { method: 'GET', pattern };
}

/**
 * Shorthand for a POST route.
 */
export function createPost<P extends string>(pattern: P | RoutePattern<P>) {
  return { method: 'POST', pattern };
}

/**
 * Shorthand for a PUT route.
 */
export function createPut<P extends string>(pattern: P | RoutePattern<P>) {
  return { method: 'PUT', pattern };
}
