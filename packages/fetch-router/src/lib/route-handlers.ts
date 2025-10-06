import type { Params } from '@remix-run/route-pattern'

import type { Middleware } from './middleware.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route, RouteMap } from './route-map.ts'

/**
 * A (nested) object mapping of route names to their respective handlers.
 */
export type RouteHandlers<T extends RouteMap> = RouteHandlersWithMiddleware<T> | RouteHandlerMap<T>

type RouteHandlersWithMiddleware<T extends RouteMap> = {
  use: Middleware[]
  handlers: RouteHandlerMap<T>
}

export function isRouteHandlersWithMiddleware<T extends RouteMap>(
  handlers: any,
): handlers is RouteHandlersWithMiddleware<T> {
  return (
    typeof handlers === 'object' && handlers != null && 'use' in handlers && 'handlers' in handlers
  )
}

// prettier-ignore
type RouteHandlerMap<T extends RouteMap> = {
  [K in keyof T]: (
    T[K] extends Route<infer M, infer P> ? RouteHandler<M, P> :
    T[K] extends RouteMap ? RouteHandlers<T[K]> :
    never
  )
}

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

// prettier-ignore
export type RouteHandlerFor<T extends Route | string> =
  T extends Route<infer M, infer P> ? RouteHandler<M, P> :
  T extends string ? RouteHandler<'ANY', T> :
  never
