import { RoutePattern } from '@remix-run/route-pattern'
import type { Join, Params } from '@remix-run/route-pattern'

import type { Simplify } from './type-utils.ts'
import { AppStorage } from './app-storage.ts'

// Route
// - request methods
// - pattern
// - input validation schema ?
// - href(route) => string

// Route Handler = route + implementation
// - route
// - middleware
// - request handler

// Router
// - middleware (global)
// - routes (route handlers)

// prettier-ignore
export const RequestMethods: RequestMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface RequestHandler<P extends AnyParams = {}, T = Response> {
  (ctx: RequestContext<P>): T | Promise<T>
}

export interface Middleware<P extends AnyParams = {}> {
  (ctx: RequestContext<P>, next: NextFunction): Response | Promise<Response> | void | Promise<void>
}

export type NextFunction = () => Promise<Response>

export class RequestContext<P extends AnyParams = {}> {
  readonly params: P
  readonly request: Request
  readonly url: URL
  readonly storage: AppStorage

  constructor(params: P, request: Request, url: URL) {
    this.params = params
    this.request = request
    this.url = url
    this.storage = new AppStorage()
  }
}

type AnyParams = Record<string, any>

// Route ///////////////////////////////////////////////////////////////////////////////////////////

export interface RouteMap {
  [key: string]: Route | RouteMap
}

export function isRouteMap(value: any): value is RouteMap {
  if (typeof value !== 'object' || value == null) return false

  for (let key in value) {
    if (!(value[key] instanceof Route) && !isRouteMap(value[key])) return false
  }

  return true
}

export class Route<M extends RequestMethod = RequestMethod, P extends string = string> {
  readonly methods: M[]
  readonly pattern: RoutePattern<P>

  constructor(methods: M | M[], pattern: P | RoutePattern<P>) {
    this.methods = Array.isArray(methods) ? methods : [methods]
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
  }

  href(...args: any): string {
    return this.pattern.href(...args)
  }
}

// prettier-ignore
type BuildRouteMap<B extends string, T extends RouteDefs> = Simplify<{
  [K in keyof T]: (
    T[K] extends RouteMap ? BuildRouteMap<B, T[K]> :
    T[K] extends RouteDef ? BuildRoute<B, T[K]> :
    T[K] extends RouteDefs ? BuildRouteMap<B, T[K]> :
    never
  )
}>

export type RouteDefs = {
  [key: string]: RouteMap | RouteDef | RouteDefs
}

// prettier-ignore
type BuildRoute<B extends string, T extends RouteDef> =
  T extends string ? Route<RequestMethod, Join<B, T>> :
  T extends RoutePattern<infer P extends string> ? Route<RequestMethod, Join<B, P>> :
  T extends MultiMethodRouteDef<infer P extends string> ?
    T['methods'] extends readonly RequestMethod[] ? Route<T['methods'][number], Join<B, P>> :
    never :
  T extends SingleMethodRouteDef<infer P extends string> ?
    undefined extends T['method'] ? Route<RequestMethod, Join<B, P>> :
    T['method'] extends RequestMethod ? Route<T['method'], Join<B, P>> :
    Route<RequestMethod, Join<B, P>> :
  never

type RouteDef<P extends string = string> =
  | P
  | RoutePattern<P>
  | MultiMethodRouteDef<P>
  | SingleMethodRouteDef<P>

type MultiMethodRouteDef<P extends string = string> = {
  methods: readonly RequestMethod[]
  pattern: P | RoutePattern<P>
}

type SingleMethodRouteDef<P extends string = string> = {
  method?: RequestMethod
  pattern: P | RoutePattern<P>
}

/**
 * Create a route map from a set of route definitions.
 */
export function createRoutes<P extends string, const D extends RouteDefs>(
  base: P | RoutePattern<P>,
  routeDefs: D,
): BuildRouteMap<P, D>
export function createRoutes<const D extends RouteDefs>(routeDefs: D): BuildRouteMap<'/', D>
export function createRoutes(baseOrRouteDefs: any, routeDefs?: RouteDefs): RouteMap {
  let base: RoutePattern
  if (typeof baseOrRouteDefs === 'string' || baseOrRouteDefs instanceof RoutePattern) {
    if (routeDefs == null) {
      throw new Error('Missing route definitions')
    }

    base = typeof baseOrRouteDefs === 'string' ? new RoutePattern(baseOrRouteDefs) : baseOrRouteDefs
  } else {
    routeDefs = baseOrRouteDefs
    base = new RoutePattern('/')
  }

  return _createRoutes(base, routeDefs!)
}

function _createRoutes<P extends string, D extends RouteDefs>(
  base: RoutePattern<P>,
  routeDefs: D,
  parentKeys: string[] = [],
): BuildRouteMap<P, D> {
  let routes = {} as any

  for (let key in routeDefs) {
    let keys = [...parentKeys, key]
    let routeDef = routeDefs[key]

    if (typeof routeDef === 'string' || routeDef instanceof RoutePattern) {
      // value is a pattern, define routes for all request methods
      routes[key] = new Route(RequestMethods, base.join(routeDef))
    } else if (isRouteMap(routeDef)) {
      // value is a route map, remap it on top of base
      routes[key] = createRoutes(base, routeDef)
    } else if (typeof routeDef === 'object' && routeDef != null) {
      if ('pattern' in routeDef) {
        // value is a single route definition
        // prettier-ignore
        let routeMethods =
            'method' in routeDef && routeDef.method ? [routeDef.method] :
            'methods' in routeDef && Array.isArray(routeDef.methods) ? routeDef.methods :
            RequestMethods

        if (routeMethods.length > 0 && routeDef.pattern) {
          let pattern = routeDef.pattern
          if (typeof pattern === 'string' || pattern instanceof RoutePattern) {
            routes[key] = new Route(routeMethods, base.join(pattern))
          }
        }
      } else {
        // value is nested route definitions
        routes[key] = _createRoutes(base, routeDef as RouteDefs, keys)
      }
    }
  }

  return routes
}

// Route handler ///////////////////////////////////////////////////////////////////////////////////

export interface RouteHandlerMap {
  [key: string]: RouteHandler | RouteHandlerMap
}

export function isRouteHandlerMap(value: any): value is RouteHandlerMap {
  if (typeof value !== 'object' || value == null) return false

  for (let key in value) {
    if (!(value[key] instanceof RouteHandler) && !isRouteHandlerMap(value[key])) return false
  }

  return true
}

/**
 * Create a route handler map from a route map and route handler definitions.
 */
export function createHandlers<T extends RouteMap>(
  routes: T,
  handlerDefs: RouteHandlerDefs<T>,
): BuildRouteHandlerMap<T>
export function createHandlers<T extends RouteMap>(
  routes: T,
  middleware: Middleware[],
  handlerDefs: RouteHandlerDefs<T>,
): BuildRouteHandlerMap<T>
export function createHandlers<T extends RouteMap>(
  routes: T,
  middlewareOrHandlerDefs: any,
  handlerDefs?: RouteHandlerDefs<T>,
): RouteHandlerMap {
  let middleware: Middleware[] | null = null
  if (Array.isArray(middlewareOrHandlerDefs)) {
    if (handlerDefs == null) {
      throw new Error('Missing handler definitions')
    }

    middleware = middlewareOrHandlerDefs
  } else {
    handlerDefs = middlewareOrHandlerDefs
  }

  return _createHandlers(routes, middleware, handlerDefs!)
}

function _createHandlers<T extends RouteMap>(
  routes: T,
  middleware: Middleware[] | null,
  handlerDefs: RouteHandlerDefs<T>,
  parentKeys: string[] = [],
): BuildRouteHandlerMap<T> {
  let handlers = {} as any

  for (let key in routes) {
    let keys = [...parentKeys, key]
    let route = routes[key]
    let handlerDef = handlerDefs[key]

    if (handlerDef == null) {
      throw new Error(`Missing handler definition for route ${keys.join('.')}`)
    }

    if (route instanceof Route) {
      // value is a Route, create a RouteHandler
      if (typeof handlerDef === 'function') {
        // handler is a request handler function
        handlers[key] = new RouteHandler(route, handlerDef as any, middleware)
      } else if ('handler' in handlerDef && handlerDef.handler != null) {
        // handler is a SingleMethodRouteHandlerDef
        handlers[key] = new RouteHandler(
          route,
          handlerDef.handler as any,
          concatMiddleware(middleware, handlerDef.use),
        )
      } else {
        // handler is a MultiMethodRouteHandlerDef
        let requestHandlers = handlerDef as any

        for (let method of route.methods) {
          let requestHandler = requestHandlers[method] ?? requestHandlers[method.toLowerCase()]

          if (requestHandler == null) {
            throw new Error(`Missing request handler for ${method} on route ${keys.join('.')}`)
          }

          handlers[key] = new RouteHandler(
            route,
            requestHandler as any,
            concatMiddleware(middleware, handlerDef.use),
          )
        }
      }
    } else if (isRouteHandlerMap(handlerDef)) {
      // Use existing RouteHandlerMap directly
      handlers[key] = handlerDef
    } else {
      // Create nested handlers from definitions
      handlers[key] = _createHandlers(route, middleware, handlerDef as any, keys)
    }
  }

  return handlers
}

function concatMiddleware(
  middleware: Middleware[] | null,
  routeMiddleware: any,
): Middleware[] | null {
  if (routeMiddleware == null || !Array.isArray(routeMiddleware)) return middleware
  if (middleware == null) return routeMiddleware
  return [...middleware, ...routeMiddleware]
}

class RouteHandler<R extends Route = Route> {
  readonly route: R
  readonly middleware: Middleware<RouteParams<R>>[] | null
  readonly requestHandler: RequestHandler<RouteParams<R>>

  constructor(
    route: R,
    handler: RequestHandler<RouteParams<R>>,
    middleware: Middleware<RouteParams<R>>[] | null,
  ) {
    this.route = route
    this.middleware = middleware
    this.requestHandler = handler
  }
}

type RouteParams<R extends Route> = R extends Route<any, infer P extends string> ? Params<P> : never

// prettier-ignore
type BuildRouteHandlerMap<T extends RouteMap> = Simplify<{
  [K in keyof T]: (
    T[K] extends RouteHandlerMap ? T[K] :
    T[K] extends Route ? RouteHandler<T[K]> :
    T[K] extends RouteMap ? BuildRouteHandlerMap<T[K]> :
    never
  )
}>

// prettier-ignore
type RouteHandlerDefs<T extends RouteMap> = {
  [K in keyof T]: (
    T[K] extends Route ? RouteHandlerDef<T[K]> :
    T[K] extends RouteMap ? RouteHandlerDefs<T[K]> | RouteHandlerMap :
    never
  )
}

// prettier-ignore
// type BuildRouteMap<B extends string, T extends RouteDefs> = Simplify<{
//   [K in keyof T]: (
//     T[K] extends RouteMap ? BuildRouteMap<B, T[K]> :
//     T[K] extends RouteDef ? BuildRoute<B, T[K]> :
//     T[K] extends RouteDefs ? BuildRouteMap<B, T[K]> :
//     never
//   )
// }>

// export type RouteDefs = {
//   [key: string]: RouteMap | RouteDef | RouteDefs
// }

type RouteHandlerDef<R extends Route> =
  | FunctionRouteHandlerDef<R>
  | SingleMethodRouteHandlerDef<R>
  | MultiMethodRouteHandlerDef<R>

type FunctionRouteHandlerDef<R extends Route, T = unknown> =
  R extends Route<infer _, infer P extends string> ? RequestHandler<Params<P>, T> : never

interface SingleMethodRouteHandlerDef<R extends Route, T = unknown> {
  use?: Middleware<RouteParams<R>>[]
  handler: RequestHandler<RouteParams<R>, T>
}

// prettier-ignore
type MultiMethodRouteHandlerDef<R extends Route, T = unknown> =
  { use?: Middleware<RouteParams<R>>[] } & (
    R extends Route<infer M extends RequestMethod, infer P extends string> ? (
      ('GET' extends M ? { GET: RequestHandler<Params<P>, T> } | { get: RequestHandler<Params<P>, T> } : {}) &
      ('HEAD' extends M ? { HEAD: RequestHandler<Params<P>, T> } | { head: RequestHandler<Params<P>, T> } : {}) &
      ('POST' extends M ? { POST: RequestHandler<Params<P>, T> } | { post: RequestHandler<Params<P>, T> } : {}) &
      ('PUT' extends M ? { PUT: RequestHandler<Params<P>, T> } | { put: RequestHandler<Params<P>, T> } : {}) &
      ('PATCH' extends M ? { PATCH: RequestHandler<Params<P>, T> } | { patch: RequestHandler<Params<P>, T> } : {}) &
      ('DELETE' extends M ? { DELETE: RequestHandler<Params<P>, T> } | { delete: RequestHandler<Params<P>, T> } : {}) &
      ('OPTIONS' extends M ? { OPTIONS: RequestHandler<Params<P>, T> } | { options: RequestHandler<Params<P>, T> } : {})
    ) :
    never
  )

// Router //////////////////////////////////////////////////////////////////////////////////////////

// export function createRouter(routes: RouteMap, handlers: RouteHandlerDefs<RouteMap>): Router
// export function createRouter(routes: RouteMap, middleware: Middleware[], handlers: RouteHandlerDefs<RouteMap>): Router

type RouteStorage = {
  [K in RequestMethod]: Route<K, string>[]
}

export class Router {
  #routes: RouteStorage = {
    GET: [],
    HEAD: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
    OPTIONS: [],
  }
}
