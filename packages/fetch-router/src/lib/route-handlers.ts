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
export type InferRouteHandler<
  Method extends RequestMethod | 'ANY',
  P extends string | RoutePattern | Route,
> =
  P extends string ? RouteHandler<Method, P> :
  P extends RoutePattern<infer S> ? RouteHandler<Method, S> :
  P extends Route<infer _, infer S> ? RouteHandler<Method, S> :
  never

/**
 * An individual route handler.
 */
export type RouteHandler<M extends RequestMethod | 'ANY', P extends string> =
  | RequestHandlerWithMiddleware<M, P>
  | RequestHandler<M, Params<P>>

type RequestHandlerWithMiddleware<M extends RequestMethod | 'ANY', P extends string> = {
  use: Middleware<M, Params<P>>[]
  handler: RequestHandler<M, Params<P>>
}

export function isRequestHandlerWithMiddleware<M extends RequestMethod | 'ANY', T extends string>(
  handler: any,
): handler is RequestHandlerWithMiddleware<M, T> {
  return typeof handler === 'object' && handler != null && 'use' in handler && 'handler' in handler
}
