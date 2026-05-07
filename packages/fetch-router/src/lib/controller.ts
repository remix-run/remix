import type { Params, RoutePattern } from '@remix-run/route-pattern'
import type { Route, RouteMap } from '@remix-run/routes'

import type { AnyMiddleware } from './middleware.ts'
import type { ContextWithParams, DefaultContext, RequestContext } from './request-context.ts'

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

type ActionRoute = string | RoutePattern | Route

// prettier-ignore
type ActionPattern<route extends ActionRoute> =
  route extends string ? route :
  route extends RoutePattern<infer pattern extends string> ? pattern :
  route extends Route<any, infer pattern extends string> ? pattern :
  never

/**
 * An individual route action.
 *
 * Actions can be plain handler functions or action objects with optional inline middleware.
 * Most app code should use {@link createAction}; use this type directly when you need
 * to describe an action for an explicit request-context type.
 */
export type Action<
  route extends ActionRoute,
  context extends RequestContext<any, any> = DefaultContext,
> =
  | RequestHandler<
      Params<ActionPattern<route>>,
      ContextWithParams<context, Params<ActionPattern<route>>>
    >
  | {
      middleware?: readonly AnyMiddleware[] | undefined
      handler: RequestHandler<
        Params<ActionPattern<route>>,
        ContextWithParams<context, Params<ActionPattern<route>>>
      >
    }

/**
 * Defines an action with route-aware params and the default router context.
 *
 * This helper returns the action unchanged while giving TypeScript the route pattern it needs to
 * type `context.params`. If an action's local middleware adds context values, compose those values
 * into the action context type before using {@link Action} directly.
 *
 * @param route The route pattern or route object this action handles.
 * @param action The handler function or action object to type-check.
 * @returns The same action value.
 */
export function createAction<
  route extends ActionRoute,
  context extends RequestContext<any, any> = DefaultContext,
  action extends Action<route, context> = Action<route, context>,
>(route: route, action: action): action
export function createAction(route: ActionRoute, action: Action<ActionRoute, RequestContext>) {
  void route
  return action
}

export interface ActionShape {
  middleware?: readonly AnyMiddleware[]
  handler: RequestHandler<any, any>
}

export function isAction(obj: unknown): obj is ActionShape {
  return isRecord(obj) && typeof obj.handler === 'function'
}

// prettier-ignore
type ControllerActions<routes extends RouteMap, context extends RequestContext<any, any>> = routes extends any ?
  {
    [name in keyof routes as routes[name] extends Route<any, any> ? name : never]: (
      routes[name] extends Route<any, infer pattern extends string> ? Action<pattern, context> :
      never
    )
  } & {
    [name in keyof routes as routes[name] extends RouteMap ? name : never]?: never
  } :
  never

/**
 * A controller maps route leaves in a route map to actions.
 *
 * Controllers let you store related actions together while preserving the params
 * and request-context contract for each action. Most app code should use
 * {@link createController}; use this type directly when you need to describe a
 * controller for an explicit request-context type.
 */
export type Controller<
  routes extends RouteMap,
  context extends RequestContext<any, any> = DefaultContext,
> = {
  middleware?: readonly AnyMiddleware[] | undefined
  actions: ControllerActions<routes, context>
}

/**
 * Defines a controller whose action keys and params are checked against a route map.
 *
 * This helper returns the controller unchanged while giving TypeScript the route map it needs to
 * type each action's `context.params`. If a controller's local middleware adds context values,
 * compose those values into the controller context type before using {@link Controller} directly.
 *
 * @param routes The route map this controller handles.
 * @param controller The controller object to type-check.
 * @returns The same controller value.
 */
export function createController<
  routes extends RouteMap,
  context extends RequestContext<any, any> = DefaultContext,
  controller extends Controller<routes, context> = Controller<routes, context>,
>(routes: routes, controller: controller): controller
export function createController(
  routes: RouteMap,
  controller: Controller<RouteMap, RequestContext>,
) {
  void routes
  return controller
}

export interface ControllerShape {
  middleware?: readonly AnyMiddleware[]
  actions: Record<string, unknown>
}

export function isController(obj: unknown): obj is ControllerShape {
  return isRecord(obj) && isRecord(obj.actions)
}

function isRecord(obj: unknown): obj is Record<PropertyKey, unknown> {
  return typeof obj === 'object' && obj != null && !Array.isArray(obj)
}
