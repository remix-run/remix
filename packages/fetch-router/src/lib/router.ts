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
 * Options for creating a router from handlers.
 */
export interface RouterOptions {
  /**
   * The default request handler that runs when no route matches.
   *
   * @default A 404 "Not Found" response
   */
  defaultHandler?: RequestHandler
  /**
   * Global middleware to run for all routes. This middleware runs on every request before any
   * routes are matched.
   */
  middleware?: Middleware[]
}

/**
 * A router function that handles incoming requests.
 */
export interface Router {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>
}

/**
 * A handlers map for building a router by mapping routes to request handlers.
 */
export interface Handlers {
  /**
   * Add a route with an explicit method, or add a route/controller.
   *
   * @param methodOrTarget The request method (for 3-arg form) or route/pattern/route map (for 2-arg form)
   * @param patternOrHandler The pattern (for 3-arg form) or action/controller (for 2-arg form)
   * @param action The action to invoke when the route matches (only for 3-arg form)
   */
  add<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: Action<method, pattern>,
  ): void
  add<target extends MapTarget>(target: target, handler: MapHandler<target>): void
  /**
   * Add a `GET` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: Action<'GET', pattern>,
  ): void
  /**
   * Add a `HEAD` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: Action<'HEAD', pattern>,
  ): void
  /**
   * Add a `POST` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: Action<'POST', pattern>,
  ): void
  /**
   * Add a `PUT` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: Action<'PUT', pattern>,
  ): void
  /**
   * Add a `PATCH` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: Action<'PATCH', pattern>,
  ): void
  /**
   * Add a `DELETE` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: Action<'DELETE', pattern>,
  ): void
  /**
   * Add an `OPTIONS` route.
   *
   * @param route The route/pattern to match
   * @param action The action to invoke when the route matches
   */
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: Action<'OPTIONS', pattern>,
  ): void
  /**
   * Create an immutable router from the handlers.
   *
   * @param options Options to configure the router
   * @returns A router function that handles incoming requests
   */
  router(options?: RouterOptions): Router
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

/**
 * Create a new handlers map for building a router.
 *
 * @returns The handlers map
 */
export function createHandlers(): Handlers {
  let routes: { method: RequestMethod | 'ANY'; pattern: string | RoutePattern; data: MatchData }[] =
    []

  function dispatch(
    matcher: ArrayMatcher<MatchData>,
    context: RequestContext,
    defaultHandler: RequestHandler,
  ): Promise<Response> {
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

    let pattern = route instanceof Route ? route.pattern : route

    routes.push({
      method,
      pattern,
      data: {
        handler: requestHandler,
        method,
        middleware,
      },
    })
  }

  function addRoutes(target: MapTarget, handler: unknown): void {
    // Single route: string, RoutePattern, or Route
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute('ANY', target as any, handler as Action<any, any>)
      return
    }

    // Route map
    if (isControllerWithMiddleware(handler)) {
      // add(routes, { middleware, actions })
      addControllerWithMiddleware(target, handler.middleware, handler.actions)
    } else {
      // add(routes, controller)
      addController(target, handler as Record<string, unknown>)
    }
  }

  function addControllerWithMiddleware(
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
        addControllerWithMiddleware(
          route as RouteMap,
          middleware.concat(action.middleware),
          action.actions,
        )
      } else {
        // Nested controller without middleware - pass down current middleware
        addControllerWithMiddleware(
          route as RouteMap,
          middleware,
          action as Record<string, unknown>,
        )
      }
    }
  }

  function addController(routes: RouteMap, controller: Record<string, unknown>): void {
    for (let key in routes) {
      let route = routes[key]
      let action = controller[key]

      if (route instanceof Route) {
        addRoute(route.method, route.pattern, action as Action<any, any>)
      } else {
        addRoutes(route as RouteMap, action)
      }
    }
  }

  return {
    add(...args: any[]): void {
      if (args.length === 2) {
        // add(routes, controller) or add(routes, handler)
        addRoutes(args[0], args[1])
      } else {
        // add(method, pattern, action)
        addRoute(args[0], args[1], args[2])
      }
    },
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
    router(options?: RouterOptions): Router {
      let defaultHandler = options?.defaultHandler ?? noMatchHandler
      let globalMiddleware = options?.middleware

      // Create a new matcher and snapshot the current routes
      let matcher = new ArrayMatcher<MatchData>()
      for (let { pattern, data } of routes) {
        matcher.add(pattern, data)
      }

      return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        let request = new Request(input, init)

        if (request.signal.aborted) {
          throw request.signal.reason
        }

        let context = new RequestContext(request)

        if (globalMiddleware) {
          return runMiddleware(globalMiddleware, context, (ctx) =>
            dispatch(matcher, ctx, defaultHandler),
          )
        }

        return dispatch(matcher, context, defaultHandler)
      }
    },
  }
}

/**
 * @deprecated Use `createHandlers()` instead and call `.router()` to create the router function.
 *
 * Create a router (legacy API for backward compatibility).
 *
 * @param options Options to configure the router
 * @returns A router with mutation methods and a fetch function
 */
export function createRouter(options?: RouterOptions): LegacyRouter {
  let handlers = createHandlers()
  let defaultHandler = options?.defaultHandler
  let middleware = options?.middleware
  let router: Router | undefined

  return {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      if (!router) {
        router = handlers.router({ defaultHandler, middleware })
      }
      return router(input, init)
    },
    get size(): number {
      throw new Error(
        'The .size property is no longer supported. Use the new createHandlers() API.',
      )
    },
    route(method, pattern, action) {
      handlers.add(method, pattern as any, action as any)
    },
    map(target, handler) {
      handlers.add(target as any, handler as any)
    },
    get(route, action) {
      handlers.get(route, action)
    },
    head(route, action) {
      handlers.head(route, action)
    },
    post(route, action) {
      handlers.post(route, action)
    },
    put(route, action) {
      handlers.put(route, action)
    },
    patch(route, action) {
      handlers.patch(route, action)
    },
    delete(route, action) {
      handlers.delete(route, action)
    },
    options(route, action) {
      handlers.options(route, action)
    },
  }
}

/**
 * Legacy router interface for backward compatibility.
 * @deprecated Use `Handlers` and `Router` instead.
 */
export interface LegacyRouter {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
  readonly size: number
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    action: Action<method, pattern>,
  ): void
  map<target extends MapTarget>(target: target, handler: MapHandler<target>): void
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    action: Action<'GET', pattern>,
  ): void
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    action: Action<'HEAD', pattern>,
  ): void
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    action: Action<'POST', pattern>,
  ): void
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    action: Action<'PUT', pattern>,
  ): void
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    action: Action<'PATCH', pattern>,
  ): void
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    action: Action<'DELETE', pattern>,
  ): void
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    action: Action<'OPTIONS', pattern>,
  ): void
}
