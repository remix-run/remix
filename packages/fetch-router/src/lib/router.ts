import { type Matcher, RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type Middleware, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import { type RouteHandlers, type RouteHandler, hasHandlers, hasHandler } from './route-handlers.ts'
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
 * A router maps incoming requests to route handler functions and middleware.
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
   * @param handler The request handler to invoke when the route matches
   */
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    handler: RouteHandler<method, pattern>,
  ): void
  /**
   * Map a route map (or route/pattern) to request handler(s).
   *
   * @param route The route(s)/pattern to match
   * @param handler The request handler(s) to invoke when the routes match
   */
  map<
    route extends RouteMap | Route<RequestMethod | 'ANY', string> | RoutePattern<string> | string,
  >(
    route: route,
    handler: // prettier-ignore
    // map(routeMap, routeHandlers)
    [route] extends [RouteMap] ? RouteHandlers<route> :

    // map(route, routeHandler)
    route extends Route<
      infer method extends RequestMethod | 'ANY',
      infer source extends string
    > ? method extends 'ANY' ? RouteHandler<RequestMethod | 'ANY', source> : RouteHandler<method, source> :

    // map(pattern, routeHandler)
    route extends RoutePattern<infer source extends string> ? RouteHandler<RequestMethod | 'ANY', source> :

    // map(stringPattern, routeHandler)
    route extends string ? RouteHandler<RequestMethod | 'ANY', route>:

    never,
  ): void
  /**
   * Map a `GET` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    handler: RouteHandler<'GET', pattern>,
  ): void
  /**
   * Map a `HEAD` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    handler: RouteHandler<'HEAD', pattern>,
  ): void
  /**
   * Map a `POST` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    handler: RouteHandler<'POST', pattern>,
  ): void
  /**
   * Map a `PUT` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    handler: RouteHandler<'PUT', pattern>,
  ): void
  /**
   * Map a `PATCH` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    handler: RouteHandler<'PATCH', pattern>,
  ): void
  /**
   * Map a `DELETE` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    handler: RouteHandler<'DELETE', pattern>,
  ): void
  /**
   * Map an `OPTIONS` route/pattern to a request handler.
   *
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    handler: RouteHandler<'OPTIONS', pattern>,
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
    handler: RouteHandler<method, pattern>,
  ): void {
    let routeMiddleware: Middleware<any, any>[] | undefined
    let requestHandler: RequestHandler<any, any>
    if (hasHandler(handler)) {
      routeMiddleware = handler.middleware
      requestHandler = handler.handler
    } else {
      requestHandler = handler
    }

    matcher.add(pattern instanceof Route ? pattern.pattern : pattern, {
      handler: requestHandler,
      method,
      middleware: routeMiddleware,
    })
  }

  function mapRoute(routeArg: any, handlerArg: any): void {
    if (typeof routeArg === 'string' || routeArg instanceof RoutePattern) {
      // map(pattern, handler)
      addRoute('ANY', routeArg, handlerArg)
    } else if (routeArg instanceof Route) {
      // map(route, handler)
      addRoute(routeArg.method, routeArg.pattern, handlerArg)
    } else if (!hasHandlers(handlerArg)) {
      // map(routes, handlers)
      let handlers = handlerArg
      for (let key in routeArg) {
        let route = routeArg[key]
        let handler = handlers[key]

        if (route instanceof Route) {
          addRoute(route.method, route.pattern, handler)
        } else {
          mapRoute(route, handler)
        }
      }
    } else {
      // map(routes, { middleware?, handlers })
      let mapMiddleware = handlerArg.middleware
      let handlers = handlerArg.handlers
      for (let key in routeArg) {
        let route = routeArg[key]
        let handler = (handlers as any)[key]

        if (route instanceof Route) {
          let routeMiddleware =
            mapMiddleware && handler.middleware
              ? mapMiddleware.concat(handler.middleware)
              : mapMiddleware || handler.middleware

          if (hasHandler(handler)) {
            addRoute(route.method, route.pattern, {
              middleware: routeMiddleware,
              handler: handler.handler,
            })
          } else {
            addRoute(route.method, route.pattern, { middleware: routeMiddleware, handler })
          }
        } else if (hasHandlers(handler)) {
          // map(routes, { middleware?, handlers: { home: { middleware?, handlers } } })
          let routeMiddleware =
            mapMiddleware && handler.middleware
              ? mapMiddleware.concat(handler.middleware)
              : mapMiddleware || handler.middleware

          mapRoute(route, { middleware: routeMiddleware, handlers: handler.handlers })
        } else {
          // map(routes, { middleware?, handlers })
          mapRoute(route, { middleware: mapMiddleware, handlers: handler })
        }
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
      handler: RouteHandler<'GET', pattern>,
    ): void {
      addRoute('GET', route, handler)
    },
    head<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
      handler: RouteHandler<'HEAD', pattern>,
    ): void {
      addRoute('HEAD', route, handler)
    },
    post<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
      handler: RouteHandler<'POST', pattern>,
    ): void {
      addRoute('POST', route, handler)
    },
    put<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
      handler: RouteHandler<'PUT', pattern>,
    ): void {
      addRoute('PUT', route, handler)
    },
    patch<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
      handler: RouteHandler<'PATCH', pattern>,
    ): void {
      addRoute('PATCH', route, handler)
    },
    delete<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
      handler: RouteHandler<'DELETE', pattern>,
    ): void {
      addRoute('DELETE', route, handler)
    },
    options<pattern extends string>(
      route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
      handler: RouteHandler<'OPTIONS', pattern>,
    ): void {
      addRoute('OPTIONS', route, handler)
    },
  }
}
