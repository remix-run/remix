import { RoutePattern } from '@remix-run/route-pattern'
import type { Params } from '@remix-run/route-pattern'

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RouteHandler<T extends string> {
  (arg: { request: Request; params: Params<T> }): Response | Promise<Response>
}

export interface RouteOptions<M extends RouteMethod, T extends string> {
  method?: M
  pattern: T | RoutePattern<T>
  handler: RouteHandler<T>
}

export class Route<M extends RouteMethod, T extends string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly handler: RouteHandler<T>

  constructor(options: RouteOptions<M, T>) {
    this.method = (options.method ?? 'GET') as M
    this.pattern =
      typeof options.pattern === 'string' ? new RoutePattern(options.pattern) : options.pattern
    this.handler = options.handler
  }
}

export function createRoute<M extends RouteMethod, T extends string>(
  options: RouteOptions<M, T>,
): Route<M, T> {
  return new Route(options)
}
