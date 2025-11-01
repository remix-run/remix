import type { Params, RoutePattern } from '@remix-run/route-pattern'

import type { Middleware } from './middleware.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route, RouteMap } from './route-map.ts'

// prettier-ignore
export type RouteHandlers<routes extends RouteMap> =
  | RouteHandlersWithMiddleware<routes>
  | {
      [name in keyof routes]: (
        routes[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? RouteHandler<method, pattern> :
        routes[name] extends RouteMap ? RouteHandlers<routes[name]> :
        never
      )
    }

type RouteHandlersWithMiddleware<routes extends RouteMap> = {
  use: Middleware[]
  handlers: RouteHandlers<routes>
}

export function isRouteHandlersWithMiddleware<routes extends RouteMap>(
  handlers: any,
): handlers is RouteHandlersWithMiddleware<routes> {
  return (
    typeof handlers === 'object' && handlers != null && 'use' in handlers && 'handlers' in handlers
  )
}

/**
 * An individual route handler.
 */
export type RouteHandler<method extends RequestMethod | 'ANY', pattern extends string> =
  | RequestHandlerWithMiddleware<method, pattern>
  | RequestHandler<method, Params<pattern>>

type RequestHandlerWithMiddleware<method extends RequestMethod | 'ANY', pattern extends string> = {
  use: Middleware<method, Params<pattern>>[]
  handler: RequestHandler<method, Params<pattern>>
}

export function isRequestHandlerWithMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
>(handler: any): handler is RequestHandlerWithMiddleware<method, pattern> {
  return typeof handler === 'object' && handler != null && 'use' in handler && 'handler' in handler
}

/**
 * Build a `RouteHandler` type from a string, route pattern, or route.
 */
// prettier-ignore
export type BuildRouteHandler<method extends RequestMethod | 'ANY', route extends string | RoutePattern | Route> =
  route extends string ? RouteHandler<method, route> :
  route extends RoutePattern<infer pattern> ? RouteHandler<method, pattern> :
  route extends Route<infer _, infer pattern> ? RouteHandler<method, pattern> :
  never
