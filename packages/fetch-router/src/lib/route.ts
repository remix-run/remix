import { RoutePattern } from '@remix-run/route-pattern'

import type { ExtractRouteHandler } from './route-handlers.ts'

export type RouteMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export class Route<M extends RouteMethod = RouteMethod, T extends string = string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly handler: ExtractRouteHandler<T>

  constructor(method: M, pattern: T | RoutePattern<T>, handler: ExtractRouteHandler<T>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.handler = handler
  }
}

export function createRoute<M extends RouteMethod, T extends string>(
  method: M,
  pattern: T | RoutePattern<T>,
  handler: ExtractRouteHandler<T>,
): Route<M, T>
export function createRoute<T extends string>(
  pattern: T | RoutePattern<T>,
  handler: ExtractRouteHandler<T>,
): Route<'GET', T>
export function createRoute(a: any, b: any, c?: any): Route<RouteMethod, string> {
  if (typeof a === 'string' && typeof b === 'string' && typeof c === 'function') {
    // createRoute(method, pattern, handler)
    return new Route(a as RouteMethod, b, c)
  }

  if (typeof a === 'string' && typeof b === 'function') {
    // createRoute(pattern, handler)
    return new Route('GET', a, b)
  }

  throw new Error('Invalid arguments')
}
