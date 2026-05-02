import type { Params, RoutePattern } from '@remix-run/route-pattern'
import type { Route, RouteMap } from '@remix-run/routes'

import type { AnyMiddleware, ApplyMiddlewareTuple } from './middleware.ts'
import type { RequestContext } from './request-context.ts'
import type { WithParams } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'

export type ActionObjectWithoutMiddleware<
  params extends Record<string, any>,
  context extends RequestContext<any, any>,
> = {
  middleware?: undefined
  handler: RequestHandler<params, context>
}

export type ActionObjectWithMiddleware<
  params extends Record<string, any>,
  context extends RequestContext<any, any>,
  middleware extends readonly AnyMiddleware[],
> = {
  middleware: readonly [...middleware]
  handler: RequestHandler<params, ApplyMiddlewareTuple<context, middleware>>
}

export type ActionInput<
  params extends Record<string, any>,
  context extends RequestContext<any, any>,
  middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
> =
  | RequestHandler<params, context>
  | ActionObjectWithoutMiddleware<params, context>
  | ActionObjectWithMiddleware<params, context, middleware>

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
  middleware extends readonly AnyMiddleware[],
> = {
  middleware: readonly [...middleware]
  actions: ControllerActions<routes, ApplyMiddlewareTuple<context, middleware>>
}

/**
 * A controller object that maps the direct route leaves in a route map to action handlers.
 *
 * Controllers let you store related route handlers in one object while preserving the params
 * and request-context contract for each action. Nested route maps should be mapped with their
 * own controllers.
 */
export type Controller<
  routes extends RouteMap,
  context extends RequestContext<any, any> = RequestContext,
> =
  | ControllerWithoutMiddleware<routes, context>
  | ControllerWithMiddleware<routes, context, readonly AnyMiddleware[]>

// prettier-ignore
type ControllerActions<routes extends RouteMap, context extends RequestContext<any, any>> = routes extends any ?
  {
    [name in keyof routes as routes[name] extends Route<any, any> ? name : never]: (
      routes[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Action<method, pattern, context> :
      never
    )
  } & {
    [name in keyof routes as routes[name] extends RouteMap ? name : never]?: never
  } :
  never

export type ControllerInput<
  routes extends RouteMap,
  context extends RequestContext<any, any>,
  middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
> =
  | ControllerWithoutMiddleware<routes, context>
  | ControllerWithMiddleware<routes, context, middleware>

/**
 * An individual route action.
 *
 * Actions can be plain handler functions or action objects with optional inline middleware.
 */
export type Action<
  _method extends RequestMethod | 'ANY',
  pattern extends string,
  context extends RequestContext<any, any> = RequestContext,
> = ActionInput<Params<pattern>, WithParams<context, Params<pattern>>, readonly AnyMiddleware[]>

/**
 * Builds an {@link Action} type from a string pattern, {@link RoutePattern}, or {@link Route}.
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
  middleware?: AnyMiddleware[]
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
  middleware?: AnyMiddleware[]
  handler: RequestHandler<any, any>
}

/**
 * Check if an object has a `handler` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export function isActionObject(obj: unknown): obj is ActionObjectShape {
  return typeof obj === 'object' && obj != null && 'handler' in obj
}
