import { RoutePattern } from '@remix-run/route-pattern'

import type { RequestContext } from './request-context.ts'

export type RouteMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface RouteHandler<T extends string = string> {
  (ctx: RequestContext<T>): Response | Promise<Response>
}

export class Route<M extends RouteMethod, T extends string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly handler: RouteHandler<T>

  constructor(method: M, pattern: T | RoutePattern<T>, handler: RouteHandler<T>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.handler = handler
  }
}

export interface RouteOptions {
  method?: RouteMethod
  pattern: string | RoutePattern<string>
  handler: RouteHandler<string>
}

export function createRoute<M extends RouteMethod, T extends string>(options: {
  method: M
  pattern: T | RoutePattern<T>
  handler: RouteHandler<T>
}): Route<M, T>
export function createRoute<T extends string>(options: {
  pattern: T | RoutePattern<T>
  handler: RouteHandler<T>
}): Route<'GET', T>
export function createRoute(options: RouteOptions): Route<RouteMethod, string> {
  return new Route(options.method ?? 'GET', options.pattern, options.handler)
}
