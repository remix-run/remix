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
 * An individual route handler.
 */
export type RouteHandler<M extends RequestMethod | 'ANY', P extends string> =
  | RequestHandlerWithMiddleware<M, P>
  | RequestHandler<M, Params<P>>

type RequestHandlerWithMiddleware<M extends RequestMethod | 'ANY', P extends string> = {
  use: Middleware<M, Params<P>>[]
  handler: RequestHandler<M, Params<P>>
}

export function isRequestHandlerWithMiddleware<M extends RequestMethod | 'ANY', P extends string>(
  handler: any,
): handler is RequestHandlerWithMiddleware<M, P> {
  return typeof handler === 'object' && handler != null && 'use' in handler && 'handler' in handler
}

/**
 * Build a `RouteHandler` type from a string, route pattern, or route.
 */
// prettier-ignore
export type BuildRouteHandler<M extends RequestMethod | 'ANY', T extends string | RoutePattern | Route> =
  T extends string ? RouteHandler<M, T> :
  T extends RoutePattern<infer P> ? RouteHandler<M, P> :
  T extends Route<infer _, infer P> ? RouteHandler<M, P> :
  never
