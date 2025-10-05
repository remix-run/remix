import type { Params } from '@remix-run/route-pattern'

import type { Middleware } from './middleware.ts'
import type { RequestHandler } from './request-handler.ts'
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
    T[K] extends Route ? RouteHandler<T[K]> :
    T[K] extends RouteMap ? RouteHandlers<T[K]> :
    never
  )
}

// prettier-ignore
export type RouteHandler<T extends string | Route> =
  T extends string ? RequestHandlerWithMiddleware<T> | RequestHandler<Params<T>> :
  T extends Route<any, infer P> ? RequestHandlerWithMiddleware<P> | RequestHandler<Params<P>> :
  never

type RequestHandlerWithMiddleware<T extends string> = {
  use: Middleware<Params<T>>[]
  handler: RequestHandler<Params<T>>
}

export function isRequestHandlerWithMiddleware<T extends string>(
  handler: any,
): handler is RequestHandlerWithMiddleware<T> {
  return typeof handler === 'object' && handler != null && 'use' in handler && 'handler' in handler
}
