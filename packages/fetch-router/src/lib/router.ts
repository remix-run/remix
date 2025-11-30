import { type Matcher, RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type Middleware, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Controller,
  type Action,
  isControllerWithMiddleware,
  isActionWithMiddleware,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

type MatchData = {
  handler: RequestHandler<any>
  method: RequestMethod | 'ANY'
  middleware: Middleware<any>[] | undefined
}

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
   * @default `new RegExpMatcher()`
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
   * @return The response from the route that matched the request
   */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
  /**
   * The number of routes in the router.
   */
  readonly size: number
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
   * Map a route map (or route/pattern) to controller action(s).
   *
   * @param route The route(s)/pattern to match
   * @param controller The controller/action(s) to invoke when the routes match
   */
  map<
    route extends RouteMap | Route<RequestMethod | 'ANY', string> | RoutePattern<string> | string,
  >(
    route: route,
    controller: // prettier-ignore
    // map(stringPattern, action)
    route extends string ? Action<RequestMethod | 'ANY', route> :

    // map(pattern, action)
    route extends RoutePattern<infer source extends string> ? Action<RequestMethod | 'ANY', source> :

    // map(route, action)
    route extends Route<
      infer method extends RequestMethod | 'ANY',
      infer source extends string
    > ? method extends 'ANY' ? Action<RequestMethod | 'ANY', source> : Action<method, source> :

    // map(routeMap, controller)
    [route] extends [RouteMap] ? Controller<route> :

    never,
  ): void
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
 * @return The new router
 */
export function createRouter(options?: RouterOptions): Router {
  let defaultHandler = options?.defaultHandler ?? noMatchHandler
  let matcher = options?.matcher ?? new RegExpMatcher<MatchData>()
  let middleware = options?.middleware

  async function dispatch(context: RequestContext): Promise<Response> {
    for (let match of matcher.matchAll(context.url)) {
      let { handler, method, middleware } = match.data

      if (method !== context.method && method !== 'ANY') {
        // Request method does not match, continue to next match
        continue
      }

      context.params = match.params
      context.url = match.url

      if (middleware) {
        return runMiddleware(middleware, context, handler)
      }

      return raceRequestAbort(Promise.resolve(handler(context)), context.request)
    }

    return raceRequestAbort(Promise.resolve(defaultHandler(context)), context.request)
  }

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: Action<method, pattern>,
  ): void {
    let routeMiddleware: Middleware<any, any>[] | undefined
    let requestHandler: RequestHandler<any, any>
    if (isActionWithMiddleware(action)) {
      routeMiddleware = action.middleware.length > 0 ? action.middleware : undefined
      requestHandler = action.action
    } else {
      requestHandler = action as RequestHandler<any, any>
    }

    matcher.add(pattern instanceof Route ? pattern.pattern : pattern, {
      handler: requestHandler,
      method,
      middleware: routeMiddleware,
    })
  }

  function mapRoute(
    routeArg: RouteMap | Route | RoutePattern | string,
    controllerArg: unknown,
  ): void {
    if (typeof routeArg === 'string' || routeArg instanceof RoutePattern) {
      // map(pattern, action)
      addRoute('ANY', routeArg, controllerArg as Action<any, any>)
    } else if (routeArg instanceof Route) {
      // map(route, action)
      addRoute(routeArg.method, routeArg.pattern, controllerArg as Action<any, any>)
    } else if (isControllerWithMiddleware(controllerArg)) {
      // map(routes, { middleware, actions })
      mapControllerWithMiddleware(routeArg, controllerArg.middleware, controllerArg.actions)
    } else {
      // map(routes, controller)
      mapController(routeArg, controllerArg as Record<string, unknown>)
    }
  }

  function mapControllerWithMiddleware(
    routes: RouteMap,
    controllerMiddleware: Middleware[],
    actions: Record<string, unknown>,
  ): void {
    for (let key in routes) {
      let route = routes[key]
      let action = actions[key]

      if (route instanceof Route) {
        // Single route - check if action has its own middleware
        if (isActionWithMiddleware(action)) {
          let mergedMiddleware = controllerMiddleware.concat(action.middleware)
          addRoute(route.method, route.pattern, {
            middleware: mergedMiddleware,
            action: action.action,
          })
        } else {
          addRoute(route.method, route.pattern, {
            middleware: controllerMiddleware,
            action: action as RequestHandler<any, any>,
          })
        }
      } else if (isControllerWithMiddleware(action)) {
        // Nested controller with its own middleware - merge and recurse
        mapControllerWithMiddleware(
          route as RouteMap,
          controllerMiddleware.concat(action.middleware),
          action.actions,
        )
      } else {
        // Nested controller without middleware - pass down current middleware
        mapControllerWithMiddleware(
          route as RouteMap,
          controllerMiddleware,
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
        mapRoute(route as RouteMap, action)
      }
    }
  }

  return {
    async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let request = new Request(input, init)

      if (request.signal.aborted) {
        throw request.signal.reason
      }

      let context = new RequestContext(request)
      let response = middleware
        ? await runMiddleware(middleware, context, dispatch)
        : await dispatch(context)

      return response
    },
    get size(): number {
      return matcher.size
    },
    route: addRoute,
    map: mapRoute,
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
