import { type Matcher, type Params, ArrayMatcher, RoutePattern } from '@remix-run/route-pattern'

import {
  type ApplyMiddlewareTuple,
  type Middleware,
  type MiddlewareContext,
  runMiddleware,
} from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext, type WithContextParams } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Controller,
  type ControllerInput,
  type ControllerShape,
  type ControllerWithMiddleware,
  type ControllerWithoutMiddleware,
  type Action,
  type RequestHandler,
  isController,
  isActionObject,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

type AnyMiddleware = Middleware<any, any, any>
type MiddlewareTuple = readonly AnyMiddleware[]

type RouteContext<
  base_context extends RequestContext<any, any>,
  pattern extends string,
> = WithContextParams<base_context, Params<pattern>>

type RouteTarget<method extends RequestMethod | 'ANY', pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<method | 'ANY', pattern>

type MapRouteTarget<method extends RequestMethod | 'ANY', pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<method, pattern>

type RouteActionObjectWithoutMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  base_context extends RequestContext<any, any>,
> = {
  middleware?: undefined
  action: RequestHandler<method, Params<pattern>, RouteContext<base_context, pattern>>
}

type RouteActionObjectWithMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  base_context extends RequestContext<any, any>,
  middleware extends MiddlewareTuple,
> = {
  middleware: readonly [...middleware]
  action: RequestHandler<
    method,
    Params<pattern>,
    ApplyMiddlewareTuple<RouteContext<base_context, pattern>, middleware>
  >
}

type RouteActionInput<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  base_context extends RequestContext<any, any>,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> =
  | RequestHandler<method, Params<pattern>, RouteContext<base_context, pattern>>
  | RouteActionObjectWithoutMiddleware<method, pattern, base_context>
  | RouteActionObjectWithMiddleware<method, pattern, base_context, middleware>

/**
 * Normalized route match payload stored in the router matcher.
 */
export type MatchData = {
  handler: RequestHandler<any, any, any>
  method: RequestMethod | 'ANY'
  middleware: Middleware<any, any, any>[] | undefined
}

type NormalizedAction = {
  handler: RequestHandler<any, any, any>
  middleware: Middleware<any, any, any>[] | undefined
}

/**
 * The valid types for the first argument to `router.map()`.
 */
export type MapTarget =
  | string
  | RoutePattern<string>
  | Route<RequestMethod | 'ANY', string>
  | RouteMap

/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
// prettier-ignore
export type MapHandler<
  target extends MapTarget,
  base_context extends RequestContext<any, any> = RequestContext,
> =
  target extends string ? Action<RequestMethod | 'ANY', target, base_context> :
  target extends RoutePattern<infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, base_context> :
  target extends Route<RequestMethod | 'ANY', infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, base_context> :
  target extends RouteMap ? Controller<target, base_context> :
  never

/**
 * Options for creating a router.
 */
export interface RouterOptions<global_middleware extends MiddlewareTuple = MiddlewareTuple> {
  /**
   * The default request handler that runs when no route matches.
   *
   * @default A 404 "Not Found" response
   */
  defaultHandler?: RequestHandler<RequestMethod | 'ANY', {}, MiddlewareContext<global_middleware>>
  /**
   * The matcher to use for matching routes.
   *
   * @default `new ArrayMatcher()`
   */
  matcher?: Matcher<MatchData>
  /**
   * Global middleware to run for all routes. This middleware runs on every request before any
   * routes are matched.
   */
  middleware?: readonly [...global_middleware]
}

/**
 * A router maps incoming requests to request handlers and middleware.
 */
export interface Router<base_context extends RequestContext<any, any> = RequestContext> {
  /**
   * Fetch a response from the router.
   *
   * @param input The request input to fetch
   * @param init The request init options
   * @returns The response from the route that matched the request
   */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
  /**
   * Add a route to the router.
   *
   * @param method The request method to match
   * @param pattern The pattern to match
   * @param action The action to invoke when the route matches
   */
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RequestHandler<method, Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionObjectWithoutMiddleware<method, pattern, base_context>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionObjectWithMiddleware<method, pattern, base_context, middleware>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionInput<method, pattern, base_context, middleware>,
  ): void
  /**
   * Map a single route to an action.
   *
   * @param target The route/pattern to match
   * @param handler The action to invoke when the route matches
   */
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RequestHandler<method, Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionObjectWithoutMiddleware<method, pattern, base_context>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionObjectWithMiddleware<method, pattern, base_context, middleware>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionInput<method, pattern, base_context, middleware>,
  ): void
  /**
   * Map a route map to a controller.
   *
   * @param target The route map to match
   * @param handler The controller to invoke when the route(s) match
   */
  map<target extends RouteMap>(
    target: target,
    handler: ControllerWithoutMiddleware<target, base_context>,
  ): void
  map<target extends RouteMap, middleware extends MiddlewareTuple>(
    target: target,
    handler: ControllerWithMiddleware<target, base_context, middleware>,
  ): void
  map<target extends RouteMap, middleware extends MiddlewareTuple = MiddlewareTuple>(
    target: target,
    handler: ControllerInput<target, base_context, middleware>,
  ): void
  /**
   * Map a `GET` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  get<pattern extends string>(
    route: RouteTarget<'GET', pattern>,
    action: RequestHandler<'GET', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  get<pattern extends string>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionObjectWithoutMiddleware<'GET', pattern, base_context>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionObjectWithMiddleware<'GET', pattern, base_context, middleware>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionInput<'GET', pattern, base_context, middleware>,
  ): void
  /**
   * Map a `HEAD` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  head<pattern extends string>(
    route: RouteTarget<'HEAD', pattern>,
    action: RequestHandler<'HEAD', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  head<pattern extends string>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionObjectWithoutMiddleware<'HEAD', pattern, base_context>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionObjectWithMiddleware<'HEAD', pattern, base_context, middleware>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionInput<'HEAD', pattern, base_context, middleware>,
  ): void
  /**
   * Map a `POST` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  post<pattern extends string>(
    route: RouteTarget<'POST', pattern>,
    action: RequestHandler<'POST', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  post<pattern extends string>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionObjectWithoutMiddleware<'POST', pattern, base_context>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionObjectWithMiddleware<'POST', pattern, base_context, middleware>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionInput<'POST', pattern, base_context, middleware>,
  ): void
  /**
   * Map a `PUT` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  put<pattern extends string>(
    route: RouteTarget<'PUT', pattern>,
    action: RequestHandler<'PUT', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  put<pattern extends string>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PUT', pattern, base_context>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionObjectWithMiddleware<'PUT', pattern, base_context, middleware>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionInput<'PUT', pattern, base_context, middleware>,
  ): void
  /**
   * Map a `PATCH` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  patch<pattern extends string>(
    route: RouteTarget<'PATCH', pattern>,
    action: RequestHandler<'PATCH', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  patch<pattern extends string>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PATCH', pattern, base_context>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionObjectWithMiddleware<'PATCH', pattern, base_context, middleware>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionInput<'PATCH', pattern, base_context, middleware>,
  ): void
  /**
   * Map a `DELETE` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  delete<pattern extends string>(
    route: RouteTarget<'DELETE', pattern>,
    action: RequestHandler<'DELETE', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  delete<pattern extends string>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionObjectWithoutMiddleware<'DELETE', pattern, base_context>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionObjectWithMiddleware<'DELETE', pattern, base_context, middleware>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionInput<'DELETE', pattern, base_context, middleware>,
  ): void
  /**
   * Map an `OPTIONS` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  options<pattern extends string>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RequestHandler<'OPTIONS', Params<pattern>, RouteContext<base_context, pattern>>,
  ): void
  options<pattern extends string>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionObjectWithoutMiddleware<'OPTIONS', pattern, base_context>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionObjectWithMiddleware<'OPTIONS', pattern, base_context, middleware>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionInput<'OPTIONS', pattern, base_context, middleware>,
  ): void
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
export function createRouter(): Router
export function createRouter<global_middleware extends MiddlewareTuple>(
  options: { middleware: readonly [...global_middleware] } & Omit<
    RouterOptions<global_middleware>,
    'middleware'
  >,
): Router<MiddlewareContext<global_middleware>>
export function createRouter(options: RouterOptions): Router
export function createRouter<global_middleware extends MiddlewareTuple = []>(
  options?: RouterOptions<global_middleware>,
): Router<MiddlewareContext<global_middleware>> {
  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any, any, any>
  let matcher = options?.matcher ?? new ArrayMatcher<MatchData>()
  let globalMiddleware = options?.middleware ? [...options.middleware] : undefined

  function normalizeAction(action: unknown): NormalizedAction {
    if (isActionObject(action)) {
      return {
        handler: action.action,
        middleware:
          action.middleware && action.middleware.length > 0 ? [...action.middleware] : undefined,
      }
    }

    return {
      handler: action as RequestHandler<any, any, any>,
      middleware: undefined,
    }
  }

  function mergeMiddleware(
    routeMiddleware: Middleware<any, any, any>[] | undefined,
    actionMiddleware: Middleware<any, any, any>[] | undefined,
  ): Middleware<any, any, any>[] | undefined {
    if (!routeMiddleware || routeMiddleware.length === 0) {
      return actionMiddleware
    }

    if (!actionMiddleware || actionMiddleware.length === 0) {
      return routeMiddleware
    }

    return routeMiddleware.concat(actionMiddleware)
  }

  function createRequestContext(input: string | URL | Request, init?: RequestInit): RequestContext {
    let request = new Request(input, init)

    if (request.signal.aborted) {
      throw request.signal.reason
    }

    return new RequestContext(request)
  }

  function dispatch(context: RequestContext): Promise<Response> {
    for (let match of matcher.matchAll(context.url)) {
      let { handler, method, middleware } = match.data

      if (method !== context.method && method !== 'ANY') {
        // Request method does not match, continue to next match
        continue
      }

      context.params = match.params

      if (middleware) {
        return runMiddleware(middleware, context, handler)
      }

      return raceRequestAbort(Promise.resolve(handler(context)), context.request)
    }

    return raceRequestAbort(Promise.resolve(defaultHandler(context)), context.request)
  }

  function registerRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<method, pattern>,
    action: NormalizedAction,
  ): void {
    matcher.add(route instanceof Route ? route.pattern : route, {
      handler: action.handler,
      method,
      middleware: action.middleware,
    })
  }

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<method, pattern>,
    action: Action<method, pattern, MiddlewareContext<global_middleware>>,
  ): void {
    registerRoute(method, route, normalizeAction(action))
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute('ANY', target as any, handler as Action<any, any, MiddlewareContext<global_middleware>>)
      return
    }

    if (!isController(handler)) {
      throw new TypeError('Expected a controller with an `actions` property')
    }

    mapController(target, handler)
  }

  function mapController(
    routes: RouteMap,
    controller: ControllerShape,
    parentMiddleware: Middleware<any, any, any>[] = [],
  ): void {
    let middleware = controller.middleware
      ? parentMiddleware.concat(controller.middleware)
      : parentMiddleware

    for (let key in routes) {
      let route = routes[key]
      let action = controller.actions[key]

      if (route instanceof Route) {
        let normalizedAction = normalizeAction(action as Action<any, any, MiddlewareContext<global_middleware>>)
        let routeMiddleware = middleware.length > 0 ? middleware : undefined
        registerRoute(route.method, route.pattern, {
          handler: normalizedAction.handler,
          middleware: mergeMiddleware(routeMiddleware, normalizedAction.middleware),
        })
      } else {
        if (!isController(action)) {
          throw new TypeError(
            `Expected a nested controller with an \`actions\` property at \`${key}\``,
          )
        }

        mapController(route as RouteMap, action, middleware)
      }
    }
  }

  let router: Router<MiddlewareContext<global_middleware>> = {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let context = createRequestContext(input, init)
      context.router = router

      if (globalMiddleware) {
        return runMiddleware(globalMiddleware, context, dispatch)
      }

      return dispatch(context)
    },
    route<
      method extends RequestMethod | 'ANY',
      pattern extends string,
      middleware extends MiddlewareTuple = MiddlewareTuple,
    >(
      method: method,
      route: RouteTarget<method, pattern>,
      action: RouteActionInput<method, pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute(method, route, action as Action<method, pattern, MiddlewareContext<global_middleware>>)
    },
    map: mapRoutes,
    get<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'GET', pattern>,
      action: RouteActionInput<'GET', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('GET', route, action as Action<'GET', pattern, MiddlewareContext<global_middleware>>)
    },
    head<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'HEAD', pattern>,
      action: RouteActionInput<'HEAD', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('HEAD', route, action as Action<'HEAD', pattern, MiddlewareContext<global_middleware>>)
    },
    post<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'POST', pattern>,
      action: RouteActionInput<'POST', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('POST', route, action as Action<'POST', pattern, MiddlewareContext<global_middleware>>)
    },
    put<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'PUT', pattern>,
      action: RouteActionInput<'PUT', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('PUT', route, action as Action<'PUT', pattern, MiddlewareContext<global_middleware>>)
    },
    patch<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'PATCH', pattern>,
      action: RouteActionInput<'PATCH', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('PATCH', route, action as Action<'PATCH', pattern, MiddlewareContext<global_middleware>>)
    },
    delete<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'DELETE', pattern>,
      action: RouteActionInput<'DELETE', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('DELETE', route, action as Action<'DELETE', pattern, MiddlewareContext<global_middleware>>)
    },
    options<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'OPTIONS', pattern>,
      action: RouteActionInput<'OPTIONS', pattern, MiddlewareContext<global_middleware>, middleware>,
    ): void {
      addRoute('OPTIONS', route, action as Action<'OPTIONS', pattern, MiddlewareContext<global_middleware>>)
    },
  }

  return router
}
