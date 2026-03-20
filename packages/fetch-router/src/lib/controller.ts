import type { Params, RoutePattern } from '@remix-run/route-pattern'

import type { ApplyMiddlewareTuple, Middleware } from './middleware.ts'
import type { RequestContext } from './request-context.ts'
import type { WithParams } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route, RouteMap } from './route-map.ts'

type AnyMiddleware = Middleware<any, any, any>
type MiddlewareTuple = readonly AnyMiddleware[]

type RequestHandlerObjectWithoutMiddleware<
  method extends RequestMethod | 'ANY',
  params extends Record<string, any>,
  context extends RequestContext<any, any>,
> = {
  middleware?: undefined
  action: RequestHandler<method, params, context>
}

type RequestHandlerObjectWithMiddleware<
  method extends RequestMethod | 'ANY',
  params extends Record<string, any>,
  context extends RequestContext<any, any>,
  middleware extends MiddlewareTuple,
> = {
  middleware: readonly [...middleware]
  action: RequestHandler<method, params, ApplyMiddlewareTuple<context, middleware>>
}

type RequestHandlerDefinition<
  method extends RequestMethod | 'ANY',
  params extends Record<string, any>,
  context extends RequestContext<any, any>,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> =
  | RequestHandler<method, params, context>
  | RequestHandlerObjectWithoutMiddleware<method, params, context>
  | RequestHandlerObjectWithMiddleware<method, params, context, middleware>

export type ControllerWithoutMiddleware<
  routes extends RouteMap,
  context extends RequestContext<any, any>,
> = {
  middleware?: undefined
  actions: ControllerActions<routes, context>
}

export type ControllerWithMiddleware<
  routes extends RouteMap,
  context extends RequestContext<any, any>,
  middleware extends MiddlewareTuple,
> = {
  middleware: readonly [...middleware]
  actions: ControllerActions<routes, ApplyMiddlewareTuple<context, middleware>>
}

/**
 * Controller object that mirrors a route map with matching action handlers.
 */
export type Controller<
  routes extends RouteMap,
  context extends RequestContext<any, any> = RequestContext,
> =
  | ControllerWithoutMiddleware<routes, context>
  | ControllerWithMiddleware<routes, context, MiddlewareTuple>

// prettier-ignore
type ControllerActions<routes extends RouteMap, context extends RequestContext<any, any>> = routes extends any ?
  {
    [name in keyof routes]: (
      routes[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Action<method, pattern, context> :
      routes[name] extends RouteMap ? Controller<routes[name], context> :
      never
    )
  } :
  never

export type ControllerInput<
  routes extends RouteMap,
  context extends RequestContext<any, any>,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> =
  | ControllerWithoutMiddleware<routes, context>
  | ControllerWithMiddleware<routes, context, middleware>

/**
 * An individual route action.
 */
export type Action<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  context extends RequestContext<any, any> = RequestContext,
> = RequestHandlerDefinition<
  method,
  Params<pattern>,
  WithParams<context, Params<pattern>>,
  MiddlewareTuple
>

/**
 * Build an {@link Action} type from a string, {@link RoutePattern}, or {@link Route}.
 */
// prettier-ignore
export type BuildAction<
  method extends RequestMethod | 'ANY',
  route extends string | RoutePattern | Route,
  context extends RequestContext<any, any> = RequestContext,
> =
  route extends string ? Action<method, route, context> :
  route extends RoutePattern<infer pattern> ? Action<method, pattern, context> :
  route extends Route<infer _, infer pattern> ? Action<method, pattern, context> :
  never

/**
 * A request handler function that returns some kind of response.
 *
 * @param context The request context
 * @returns The response
 */
export interface RequestHandler<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  params extends Record<string, any> = {},
  context extends RequestContext<any, any> = RequestContext<params>,
> {
  /**
   * Handles a matched request and returns the response.
   */
  (context: context): Response | Promise<Response>
}

/**
 * Runtime shape for a controller.
 */
export interface ControllerShape {
  actions: Record<string, unknown>
  middleware?: Middleware<any, any, any>[]
}

/**
 * Check if an object has an `actions` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller
 */
export function isController(obj: unknown): obj is ControllerShape {
  return typeof obj === 'object' && obj != null && 'actions' in obj
}

/**
 * Runtime shape for an action object.
 */
export interface ActionObjectShape {
  middleware?: Middleware<any, any, any>[]
  action: RequestHandler<any, any, any>
}

/**
 * Check if an object has an `action` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export function isActionObject(obj: unknown): obj is ActionObjectShape {
  return typeof obj === 'object' && obj != null && 'action' in obj
}
