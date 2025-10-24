import type { Params, RoutePattern } from '@remix-run/route-pattern'

import type { Middleware } from './middleware.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route, RouteMap } from './route-map.ts'

// prettier-ignore
export type RouteHandlers<T extends RouteMap> =
  | RouteHandlersWithMiddleware<T>
  | {
      [K in keyof T]: (
        T[K] extends Route<infer M, infer P> ? RouteHandler<M, P> :
        T[K] extends RouteMap ? RouteHandlers<T[K]> :
        never
      )
    }

type RouteHandlersWithMiddleware<T extends RouteMap> = {
  use: Middleware[]
  handlers: RouteHandlers<T>
}

export function isRouteHandlersWithMiddleware<T extends RouteMap>(
  handlers: any,
): handlers is RouteHandlersWithMiddleware<T> {
  return (
    typeof handlers === 'object' && handlers != null && 'use' in handlers && 'handlers' in handlers
  )
}

/**
 * Infer the route handler type from a route or route pattern.
 */
// prettier-ignore
export type InferRouteHandler<T extends string | Route | RoutePattern> =
  T extends string ? RouteHandler<'ANY', T> :
  T extends RoutePattern<infer P> ? RouteHandler<'ANY', P> :
  T extends Route<infer M, infer P> ? RouteHandler<M, P> :
  never

/**
 * An individual route handler.
 */
export type RouteHandler<M extends RequestMethod | 'ANY', T extends string> =
  | RequestHandlerWithMiddleware<M, T>
  | RequestHandler<M, Params<T>>

type RequestHandlerWithMiddleware<M extends RequestMethod | 'ANY', T extends string> = {
  use: Middleware<M, Params<T>>[]
  handler: RequestHandler<M, Params<T>>
}

export function isRequestHandlerWithMiddleware<M extends RequestMethod | 'ANY', T extends string>(
  handler: any,
): handler is RequestHandlerWithMiddleware<M, T> {
  return typeof handler === 'object' && handler != null && 'use' in handler && 'handler' in handler
}
