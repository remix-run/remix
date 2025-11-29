import type { RoutePattern } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods'

/**
 * Shorthand for a DELETE route.
 */
export function createDestroy<T extends string | RoutePattern>(pattern: T) {
  return { method: 'DELETE', pattern: pattern } as RouteDefObject<'DELETE', T>
}

/**
 * Shorthand for a GET route.
 */
export function createGet<T extends string | RoutePattern>(pattern: T) {
  return { method: 'GET', pattern: pattern } as RouteDefObject<'GET', T>
}

/**
 * Shorthand for a HEAD route.
 */
export function createHead<T extends string | RoutePattern>(pattern: T) {
  return { method: 'HEAD', pattern: pattern } as RouteDefObject<'HEAD', T>
}

/**
 * Shorthand for a OPTIONS route.
 */
export function createOptions<T extends string | RoutePattern>(pattern: T) {
  return { method: 'OPTIONS', pattern: pattern } as RouteDefObject<'OPTIONS', T>
}

/**
 * Shorthand for a PATCH route.
 */
export function createPatch<T extends string | RoutePattern>(pattern: T) {
  return { method: 'PATCH', pattern: pattern } as RouteDefObject<'PATCH', T>
}

/**
 * Shorthand for a POST route.
 */
export function createPost<T extends string | RoutePattern>(pattern: T) {
  return { method: 'POST', pattern: pattern } as RouteDefObject<'POST', T>
}

/**
 * Shorthand for a PUT route.
 */
export function createPut<T extends string | RoutePattern>(pattern: T) {
  return { method: 'PUT', pattern: pattern } as RouteDefObject<'PUT', T>
}

// prettier-ignore
type RouteDefObject<M extends RequestMethod, T> = 
  T extends string ? {method: M, pattern: T} :
  T extends RoutePattern<infer P extends string> ? {method: M, pattern: RoutePattern<P>} :
  never;
