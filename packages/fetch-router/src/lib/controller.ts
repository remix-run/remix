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
export interface RequestHandler<context extends RequestContext<any, any> = RequestContext> {
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
  | RequestHandler<ContextWithParams<context, Params<ActionPattern<route>>>>
  | {
      middleware?: readonly AnyMiddleware[] | undefined
      handler: RequestHandler<ContextWithParams<context, Params<ActionPattern<route>>>>
    }

/**
 * Defines an action with route-aware params and the default router context.
 *
 * This helper returns the action unchanged while giving TypeScript the route pattern it needs to
 * type `context.params`. If local middleware adds context values, compose those values into the
 * action context type and pass it as the second generic.
 *
 * @param route The route pattern or route object this action handles.
 * @param action The handler function or action object to type-check.
 * @returns The same action value.
 */
export function createAction<
  route extends ActionRoute,
  context extends RequestContext<any, any> = DefaultContext,
  action extends Action<route, context> = Action<route, context>,
>(route: route, action: action): action {
  void route
  return action
}

export function isAction(obj: unknown): obj is {
  middleware?: readonly AnyMiddleware[] | undefined
  handler: RequestHandler<any>
} {
  return isRecord(obj) && typeof obj.handler === 'function'
}

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
  actions: routes extends any
    ? {
        [name in keyof routes as routes[name] extends Route<any, any>
          ? name
          : never]: routes[name] extends Route<any, infer pattern extends string>
          ? Action<pattern, context>
          : never
      } & {
        [name in keyof routes as routes[name] extends RouteMap ? name : never]?: never
      }
    : never
}

/**
 * Defines a controller whose action keys and params are checked against a route map.
 *
 * This helper returns the controller unchanged while giving TypeScript the route map it needs to
 * type each action's `context.params`. If local middleware adds context values, compose those
 * values into the controller context type and pass it as the second generic.
 *
 * @param routes The route map this controller handles.
 * @param controller The controller object to type-check.
 * @returns The same controller value.
 */
export function createController<
  routes extends RouteMap,
  context extends RequestContext<any, any> = DefaultContext,
  controller extends Controller<routes, context> = Controller<routes, context>,
>(routes: routes, controller: controller): controller {
  void routes
  return controller
}

export function isController(obj: unknown): obj is {
  middleware?: readonly AnyMiddleware[] | undefined
  actions: Record<string, unknown>
} {
  return isRecord(obj) && isRecord(obj.actions)
}

function isRecord(obj: unknown): obj is Record<PropertyKey, unknown> {
  return typeof obj === 'object' && obj != null && !Array.isArray(obj)
}
