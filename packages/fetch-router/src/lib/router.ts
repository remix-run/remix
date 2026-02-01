import { type Matcher, ArrayMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type Middleware, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Controller,
  type Action,
  type RequestHandler,
  isControllerWithMiddleware,
  isActionWithMiddleware,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

export type MatchData = {
  handler: RequestHandler<any>
  method: RequestMethod | 'ANY'
  middleware: Middleware<any>[] | undefined
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
  middleware?: Middleware[]
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
    action: Action<method, pattern>,
  ): void
  /**
   * Map a route or route map to an action or controller.
   *
   * @param target The route/pattern or route map to match
   * @param handler The action or controller to invoke when the route(s) match
   */
  map<target extends MapTarget>(target: target, handler: MapHandler<target>): void
  /**
   * Map a `GET` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: Action<'GET', pattern>,
  ): void
  /**
   * Map a `HEAD` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: Action<'HEAD', pattern>,
  ): void
  /**
   * Map a `POST` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: Action<'POST', pattern>,
  ): void
  /**
   * Map a `PUT` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: Action<'PUT', pattern>,
  ): void
  /**
   * Map a `PATCH` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: Action<'PATCH', pattern>,
  ): void
  /**
   * Map a `DELETE` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: Action<'DELETE', pattern>,
  ): void
  /**
   * Map an `OPTIONS` route/pattern to an action.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: Action<'OPTIONS', pattern>,
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

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: Action<method, pattern>,
  ): void {
    let middleware: Middleware<any, any>[] | undefined
    let requestHandler: RequestHandler<any, any>
    if (isActionWithMiddleware(action)) {
      middleware = action.middleware.length > 0 ? action.middleware : undefined
      requestHandler = action.action
    } else {
      requestHandler = action as RequestHandler<any, any>
    }

    matcher.add(route instanceof Route ? route.pattern : route, {
      handler: requestHandler,
      method,
      middleware,
    })
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    // Single route: string, RoutePattern, or Route
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute('ANY', target as any, handler as Action<any, any>)
      return
    }

    // Route map
    if (isControllerWithMiddleware(handler)) {
      // map(routes, { middleware, actions })
      mapControllerWithMiddleware(target, handler.middleware, handler.actions)
    } else {
      // map(routes, controller)
      mapController(target, handler as Record<string, unknown>)
    }
  }

  function mapControllerWithMiddleware(
    routes: RouteMap,
    middleware: Middleware[],
    actions: Record<string, unknown>,
  ): void {
    for (let key in routes) {
      let route = routes[key]
      let action = actions[key]

      if (route instanceof Route) {
        // Single route - check if action has its own middleware
        if (isActionWithMiddleware(action)) {
          addRoute(route.method, route.pattern, {
            middleware: middleware.concat(action.middleware),
            action: action.action,
          })
        } else {
          addRoute(route.method, route.pattern, {
            middleware,
            action: action as RequestHandler<any, any>,
          })
        }
      } else if (isControllerWithMiddleware(action)) {
        // Nested controller with its own middleware - merge and recurse
        mapControllerWithMiddleware(
          route as RouteMap,
          middleware.concat(action.middleware),
          action.actions,
        )
      } else {
        // Nested controller without middleware - pass down current middleware
        mapControllerWithMiddleware(
          route as RouteMap,
          middleware,
          action as Record<string, unknown>,
        )
      }
    }
  }

  function mapController(routes: RouteMap, controller: Record<string, unknown>): void {
    for (let key in routes) {
      let route = routes[key]
      let action = controller[key]

      if (route instanceof Route) {
        addRoute(route.method, route.pattern, action as Action<any, any>)
      } else {
        mapRoutes(route as RouteMap, action)
      }
    }
  }

  return {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let request = new Request(input, init)

      if (request.signal.aborted) {
        throw request.signal.reason
      }

      let context = new RequestContext(request)

      if (globalMiddleware) {
        return runMiddleware(globalMiddleware, context, dispatch)
      }

      return dispatch(context)
    },
    route: addRoute,
    map: mapRoutes,
    get<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
      action: Action<'GET', pattern>,
    ): void {
      addRoute('GET', route, action)
    },
    head<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
      action: Action<'HEAD', pattern>,
    ): void {
      addRoute('HEAD', route, action)
    },
    post<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
      action: Action<'POST', pattern>,
    ): void {
      addRoute('POST', route, action)
    },
    put<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
      action: Action<'PUT', pattern>,
    ): void {
      addRoute('PUT', route, action)
    },
    patch<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
      action: Action<'PATCH', pattern>,
    ): void {
      addRoute('PATCH', route, action)
    },
    delete<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
      action: Action<'DELETE', pattern>,
    ): void {
      addRoute('DELETE', route, action)
    },
    options<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
      action: Action<'OPTIONS', pattern>,
    ): void {
      addRoute('OPTIONS', route, action)
    },
  }
}
