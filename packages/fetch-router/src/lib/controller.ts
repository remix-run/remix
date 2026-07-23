import type { RoutePattern } from '@remix-run/route-pattern'
import type { MatchParams } from '@remix-run/route-pattern/match'

import type { AnyMiddleware, MiddlewareContext } from './middleware.ts'
import type { ContextWithOutput, ContextWithParams, RequestContext } from './request-context.ts'
import type { Route, RouteMap } from './route-map.ts'
import type { DefaultContext, DefaultOutput } from './router-types.ts'
import type { Defined } from './type-utils.ts'

/**
 * A request handler function that returns the router's output type.
 *
 * @param context The request context
 * @returns The router output
 */
export interface RequestHandler<
  context extends RequestContext<any, any, any> = RequestContext,
  output = DefaultOutput,
> {
  /**
   * Handles a matched request and returns the router output.
   */
  (context: context): Defined<output> | Promise<Defined<output>>
}

export function isRequestHandler(object: unknown): object is RequestHandler<any, any> {
  return typeof object === 'function'
}

type ActionRoute = string | RoutePattern | Route

// oxfmt-ignore
type ActionPattern<route extends ActionRoute> =
  route extends string ? route :
  route extends RoutePattern<infer pattern extends string> ? pattern :
  route extends Route<any, infer pattern extends string> ? pattern :
  never

type ActionContext<
  route extends ActionRoute,
  context extends RequestContext<any, any, any>,
  output,
> = ContextWithParams<ContextWithOutput<context, output>, MatchParams<ActionPattern<route>>>

export type ActionObject<
  route extends ActionRoute,
  context extends RequestContext<any, any, any> = DefaultContext,
  middleware extends readonly AnyMiddleware<any>[] = readonly AnyMiddleware<any>[],
  output = DefaultOutput,
> = {
  /**
   * Middleware that runs before this action's handler.
   */
  middleware?: readonly [...middleware] & readonly AnyMiddleware<output>[]
  /**
   * The handler that runs after this action's middleware.
   */
  handler: RequestHandler<
    MiddlewareContext<middleware, ActionContext<route, context, output>>,
    output
  >
}

/**
 * An individual route action.
 *
 * Actions may be plain request handler functions or objects with optional action middleware.
 * Most app code should use {@link createAction}; use this type directly when you need
 * to describe an action for an explicit RequestContext type.
 */
export type Action<
  route extends ActionRoute,
  context extends RequestContext<any, any, any> = DefaultContext,
  middleware extends readonly AnyMiddleware<any>[] = readonly AnyMiddleware<any>[],
  output = DefaultOutput,
> =
  | RequestHandler<ActionContext<route, context, output>, output>
  | ActionObject<route, context, middleware, output>

/**
 * Defines a route handler with route-aware params and the default router context.
 *
 * This helper returns the action unchanged while giving TypeScript the route pattern it needs to
 * type `context.params`. If action middleware adds context values, those values are available to
 * the action handler.
 *
 * @param route The route pattern or route object this action handles.
 * @param action The handler function or action object to type-check.
 * @returns The same action value.
 */
export function createAction<
  route extends ActionRoute,
  context extends RequestContext<any, any, any> = DefaultContext,
  const middleware extends readonly AnyMiddleware<any>[] = readonly AnyMiddleware<any>[],
  output = DefaultOutput,
>(
  route: route,
  action: Action<route, context, middleware, output>,
): Action<route, context, middleware, output> {
  void route
  return action
}

export function isAction(obj: unknown): obj is Action<any, any, any, any> {
  return isRequestHandler(obj) || isActionObject(obj)
}

export function isActionObject(obj: unknown): obj is ActionObject<any, any, any, any> {
  return isRecord(obj) && typeof obj.handler === 'function'
}

type ControllerActions<
  routes extends RouteMap,
  context extends RequestContext<any, any, any>,
  output,
> = routes extends any
  ? {
      [name in keyof routes as routes[name] extends Route<any, any>
        ? name
        : never]: routes[name] extends Route<any, any>
        ? Action<routes[name], context, readonly AnyMiddleware<output>[], output>
        : never
    } & {
      [name in keyof routes as routes[name] extends RouteMap ? name : never]?: never
    }
  : never

/**
 * A controller maps route leaves in a route map to actions.
 *
 * Controllers let you store related actions together while preserving the params
 * and request-context contract for each action. Most app code should use
 * {@link createController}; use this type directly when you need to describe a
 * controller for an explicit RequestContext type.
 */
export type Controller<
  routes extends RouteMap,
  context extends RequestContext<any, any, any> = DefaultContext,
  middleware extends readonly AnyMiddleware<any>[] = readonly AnyMiddleware<any>[],
  output = DefaultOutput,
> = {
  middleware?: readonly [...middleware] & readonly AnyMiddleware<output>[]
  actions: ControllerActions<
    routes,
    MiddlewareContext<middleware, ContextWithOutput<context, output>>,
    output
  >
}

/**
 * Defines a controller whose action keys and params are checked against a route map.
 *
 * This helper returns the controller unchanged while giving TypeScript the route map it needs to
 * type each action's `context.params`. If controller middleware adds context values, those values are
 * available to the controller actions.
 *
 * @param routes The route map this controller handles.
 * @param controller The controller object to type-check.
 * @returns The same controller value.
 */
export function createController<
  routes extends RouteMap,
  context extends RequestContext<any, any, any> = DefaultContext,
  const middleware extends readonly AnyMiddleware<any>[] = readonly AnyMiddleware<any>[],
  output = DefaultOutput,
>(
  routes: routes,
  controller: Controller<routes, context, middleware, output>,
): Controller<routes, context, middleware, output> {
  void routes
  return controller
}

export function isController(obj: unknown): obj is {
  middleware?: readonly AnyMiddleware<any>[] | undefined
  actions: Record<string, unknown>
} {
  return isRecord(obj) && isRecord(obj.actions)
}

function isRecord(obj: unknown): obj is Record<PropertyKey, unknown> {
  return typeof obj === 'object' && obj != null && !Array.isArray(obj)
}
