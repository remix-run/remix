import { type Matcher, type Params, ArrayMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type ApplyMiddlewareTuple, type Middleware, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Controller,
  type Action,
  type ControllerShape,
  type RequestHandler,
  isController,
  isActionObject,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

type MiddlewareTuple = readonly Middleware<any, any, any>[]

type RouteActionObjectWithoutMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
> = {
  middleware?: undefined
  action: RequestHandler<method, Params<pattern>, RequestContext<Params<pattern>>>
}

type RouteActionObjectWithMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  middleware extends MiddlewareTuple,
> = {
  middleware: readonly [...middleware]
  action: RequestHandler<
    method,
    Params<pattern>,
    ApplyMiddlewareTuple<RequestContext<Params<pattern>>, middleware>
  >
}

type RouteActionInput<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> =
  | RequestHandler<method, Params<pattern>, RequestContext<Params<pattern>>>
  | RouteActionObjectWithoutMiddleware<method, pattern>
  | RouteActionObjectWithMiddleware<method, pattern, middleware>

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
export type MapHandler<target extends MapTarget> =
  target extends string ? Action<RequestMethod | 'ANY', target> :
  target extends RoutePattern<infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern> :
  target extends Route<RequestMethod | 'ANY', infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern> :
  target extends RouteMap ? Controller<target> :
  never

/**
 * Options for creating a router.
 */
export interface RouterOptions {
  /**
   * The default request handler that runs when no route matches.
   *
   * @default A 404 "Not Found" response
   */
  defaultHandler?: RequestHandler
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
  middleware?: Middleware<any, any, any>[]
}

/**
 * A router maps incoming requests to request handlers and middleware.
 */
export interface Router {
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
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: RequestHandler<method, Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<method, pattern>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<method, pattern, middleware>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: RouteActionInput<method, pattern, middleware>,
  ): void
  /**
   * Map a single route to an action.
   *
   * @param target The route/pattern to match
   * @param handler The action to invoke when the route matches
   */
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: pattern | RoutePattern<pattern> | Route<method, pattern>,
    handler: RequestHandler<method, Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: pattern | RoutePattern<pattern> | Route<method, pattern>,
    handler: RouteActionObjectWithoutMiddleware<method, pattern>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    target: pattern | RoutePattern<pattern> | Route<method, pattern>,
    handler: RouteActionObjectWithMiddleware<method, pattern, middleware>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    target: pattern | RoutePattern<pattern> | Route<method, pattern>,
    handler: RouteActionInput<method, pattern, middleware>,
  ): void
  /**
   * Map a route map to a controller.
   *
   * @param target The route map to match
   * @param handler The controller to invoke when the route(s) match
   */
  map<target extends RouteMap>(target: target, handler: Controller<target>): void
  /**
   * Map a `GET` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: RequestHandler<'GET', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'GET', pattern>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'GET', pattern, middleware>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: RouteActionInput<'GET', pattern, middleware>,
  ): void
  /**
   * Map a `HEAD` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: RequestHandler<'HEAD', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'HEAD', pattern>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'HEAD', pattern, middleware>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: RouteActionInput<'HEAD', pattern, middleware>,
  ): void
  /**
   * Map a `POST` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: RequestHandler<'POST', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'POST', pattern>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'POST', pattern, middleware>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: RouteActionInput<'POST', pattern, middleware>,
  ): void
  /**
   * Map a `PUT` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: RequestHandler<'PUT', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PUT', pattern>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'PUT', pattern, middleware>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: RouteActionInput<'PUT', pattern, middleware>,
  ): void
  /**
   * Map a `PATCH` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: RequestHandler<'PATCH', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PATCH', pattern>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'PATCH', pattern, middleware>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: RouteActionInput<'PATCH', pattern, middleware>,
  ): void
  /**
   * Map a `DELETE` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: RequestHandler<'DELETE', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'DELETE', pattern>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'DELETE', pattern, middleware>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: RouteActionInput<'DELETE', pattern, middleware>,
  ): void
  /**
   * Map an `OPTIONS` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: RequestHandler<'OPTIONS', Params<pattern>, RequestContext<Params<pattern>>>,
  ): void
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: RouteActionObjectWithoutMiddleware<'OPTIONS', pattern>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: RouteActionObjectWithMiddleware<'OPTIONS', pattern, middleware>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: RouteActionInput<'OPTIONS', pattern, middleware>,
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
export function createRouter(options?: RouterOptions): Router {
  let defaultHandler = options?.defaultHandler ?? noMatchHandler
  let matcher = options?.matcher ?? new ArrayMatcher<MatchData>()
  let globalMiddleware = options?.middleware

  function normalizeAction<method extends RequestMethod | 'ANY', pattern extends string>(
    action: Action<method, pattern>,
  ): NormalizedAction
  function normalizeAction(action: Action<any, any>): NormalizedAction {
    if (isActionObject(action)) {
      return {
        handler: action.action,
        middleware:
          action.middleware && action.middleware.length > 0 ? action.middleware : undefined,
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
    route: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
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
    route: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: Action<method, pattern>,
  ): void {
    registerRoute(method, route, normalizeAction(action))
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    // Single route: string, RoutePattern, or Route
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute('ANY', target as any, handler as Action<any, any>)
      return
    }

    // Route map
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
        let normalizedAction = normalizeAction(action as Action<any, any>)
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

  let router: Router = {
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
      route: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
      action: RouteActionInput<method, pattern, middleware>,
    ): void {
      addRoute(method, route, action as Action<method, pattern>)
    },
    map: mapRoutes,
    get<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
      action: RouteActionInput<'GET', pattern, middleware>,
    ): void {
      addRoute('GET', route, action as Action<'GET', pattern>)
    },
    head<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
      action: RouteActionInput<'HEAD', pattern, middleware>,
    ): void {
      addRoute('HEAD', route, action as Action<'HEAD', pattern>)
    },
    post<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
      action: RouteActionInput<'POST', pattern, middleware>,
    ): void {
      addRoute('POST', route, action as Action<'POST', pattern>)
    },
    put<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
      action: RouteActionInput<'PUT', pattern, middleware>,
    ): void {
      addRoute('PUT', route, action as Action<'PUT', pattern>)
    },
    patch<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
      action: RouteActionInput<'PATCH', pattern, middleware>,
    ): void {
      addRoute('PATCH', route, action as Action<'PATCH', pattern>)
    },
    delete<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
      action: RouteActionInput<'DELETE', pattern, middleware>,
    ): void {
      addRoute('DELETE', route, action as Action<'DELETE', pattern>)
    },
    options<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
      action: RouteActionInput<'OPTIONS', pattern, middleware>,
    ): void {
      addRoute('OPTIONS', route, action as Action<'OPTIONS', pattern>)
    },
  }

  return router
}
