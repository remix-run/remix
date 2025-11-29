import type { Params, RoutePattern } from '@remix-run/route-pattern'

import type { Middleware } from './middleware.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route, RouteMap } from './route-map.ts'

// prettier-ignore
export type Controller<routes extends RouteMap> =
  | ControllerWithMiddleware<routes>
  | ControllerWithoutMiddleware<routes>

type ControllerWithMiddleware<routes extends RouteMap> = {
  middleware?: Middleware[]
  actions: ControllerWithoutMiddleware<routes>
} & (routes extends Record<string, any>
  ? {
      // Explicitly exclude route name keys from objects with `actions`
      [name in keyof routes as routes extends any ? never : name]?: never
    }
  : {})

export function hasActions<routes extends RouteMap>(
  controller: any,
): controller is ControllerWithMiddleware<routes> {
  return typeof controller === 'object' && controller != null && 'actions' in controller
}

// prettier-ignore
type ControllerWithoutMiddleware<routes extends RouteMap> = routes extends any ?
  ({
    [name in keyof routes]: (
      routes[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Action<method, pattern> :
      routes[name] extends RouteMap ? Controller<routes[name]> :
      never
    )
  } & {
    // Explicitly exclude `middleware` and `actions` from objects with route name keys
    middleware?: never
    actions?: never
  }) :
  never

/**
 * An individual route action.
 */
export type Action<method extends RequestMethod | 'ANY', pattern extends string> =
  | RequestHandlerWithMiddleware<method, pattern>
  | RequestHandler<method, Params<pattern>>

type RequestHandlerWithMiddleware<method extends RequestMethod | 'ANY', pattern extends string> = {
  middleware?: Middleware<method, Params<pattern>>[]
  action: RequestHandler<method, Params<pattern>>
}

export function hasAction<method extends RequestMethod | 'ANY', pattern extends string>(
  action: any,
): action is RequestHandlerWithMiddleware<method, pattern> {
  return typeof action === 'object' && action != null && 'action' in action
}

/**
 * Build an `Action` type from a string, `RoutePattern`, or `Route`.
 */
// prettier-ignore
export type BuildAction<method extends RequestMethod | 'ANY', route extends string | RoutePattern | Route> =
  route extends string ? Action<method, route> :
  route extends RoutePattern<infer pattern> ? Action<method, pattern> :
  route extends Route<infer _, infer pattern> ? Action<method, pattern> :
  never
