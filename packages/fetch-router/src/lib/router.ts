import { RoutePattern } from '@remix-run/route-pattern'
import type { Join, Params, HrefBuilderArgs } from '@remix-run/route-pattern'

import type { Simplify } from './type-utils.ts'
import { AppStorage } from './app-storage.ts'

// prettier-ignore
export const RequestMethods: RequestMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/**
 * A request handler function that returns some kind of response.
 */
export interface RequestHandler<P extends AnyParams = {}, T = Response> {
  (ctx: RequestContext<P>): T | Promise<T>
}

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 */
export interface Middleware<P extends AnyParams = {}> {
  (ctx: RequestContext<P>, next: NextFunction): Response | Promise<Response> | void | Promise<void>
}

export type NextFunction = () => Promise<Response>

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
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

/**
 * A nested map of routes.
 */
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
  readonly method: M
  readonly pattern: RoutePattern<P>

  constructor(method: M, pattern: P | RoutePattern<P>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
  }

  href(...args: HrefBuilderArgs<P>): string {
    return this.pattern.href(...args)
  }
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
  return typeof baseOrRouteDefs === 'string' || baseOrRouteDefs instanceof RoutePattern
    ? _createRoutes(
        typeof baseOrRouteDefs === 'string' ? new RoutePattern(baseOrRouteDefs) : baseOrRouteDefs,
        routeDefs!,
      )
    : _createRoutes(new RoutePattern('/'), baseOrRouteDefs)
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

    if (routeDef == null) {
      throw new Error(`Missing route definition for ${keys.join('.')}`)
    }

    if (typeof routeDef === 'string' || routeDef instanceof RoutePattern) {
      routes[key] = new Route('GET', base.join(routeDef))
    } else if (isObjectRouteDef(routeDef)) {
      routes[key] = new Route(routeDef.method ?? 'GET', base.join(routeDef.pattern))
    } else {
      routes[key] = _createRoutes(base, routeDef, keys)
    }
  }

  return routes
}

// prettier-ignore
export type BuildRouteMap<B extends string, D extends RouteDefs> = Simplify<{
  [K in keyof D]: (
    D[K] extends RouteDef ? BuildRoute<B, D[K]> :
    D[K] extends RouteDefs ? BuildRouteMap<B, D[K]> :
    never
  )
}>

// prettier-ignore
type BuildRoute<B extends string, T extends RouteDef> =
  T extends string ? Route<'GET', Join<B, T>> :
  T extends RoutePattern<infer P extends string> ? Route<'GET', Join<B, P>> :
  T extends ObjectRouteDef<infer P extends string> ?
    // TODO: Is this necessary? Or can we do this in just two lines?
    // undefined extends T['method'] ? Route<'GET', Join<B, P>> :
    T['method'] extends RequestMethod ? Route<T['method'], Join<B, P>> :
    Route<'GET', Join<B, P>> :
  never

type RouteDefs = {
  [key: string]: RouteDef | RouteDefs
}

type RouteDef<P extends string = string> = P | RoutePattern<P> | ObjectRouteDef<P>

type ObjectRouteDef<P extends string = string> = {
  method?: RequestMethod
  pattern: P | RoutePattern<P>
}

function isObjectRouteDef<P extends string>(value: any): value is ObjectRouteDef<P> {
  return typeof value === 'object' && value != null && 'pattern' in value && value.pattern != null
}

// Route handler ///////////////////////////////////////////////////////////////////////////////////

/**
 * A nested map of route handlers.
 */
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

export class RouteHandler<R extends Route = Route> {
  readonly route: R
  readonly middleware: Middleware<RouteParams<R>>[] | null
  readonly requestHandler: RequestHandler<RouteParams<R>>

  constructor(
    route: R,
    middleware: Middleware<RouteParams<R>>[] | null,
    requestHandler: RequestHandler<RouteParams<R>>,
  ) {
    this.route = route
    this.middleware = middleware
    this.requestHandler = requestHandler
  }

  dispatch(ctx: RequestContext<RouteParams<R>>): Response | Promise<Response> {
    if (this.middleware != null) {
      return runMiddleware(this.middleware, ctx, () => this.requestHandler(ctx))
    }

    return this.requestHandler(ctx)
  }
}

type RouteParams<R extends Route> = R extends Route<any, infer P extends string> ? Params<P> : never

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
  return Array.isArray(middlewareOrHandlerDefs)
    ? _createHandlers(routes, handlerDefs!, middlewareOrHandlerDefs)
    : _createHandlers(routes, middlewareOrHandlerDefs, null)
}

function _createHandlers<T extends RouteMap>(
  routes: T,
  handlerDefs: RouteHandlerDefs<T>,
  middleware: Middleware<any>[] | null,
  parentKeys: string[] = [],
): BuildRouteHandlerMap<T> {
  let handlers = {} as any

  for (let key in routes) {
    let keys = [...parentKeys, key]
    let value = routes[key]
    let handlerDef = handlerDefs[key]

    if (handlerDef == null) {
      throw new Error(`Missing handler definition for ${keys.join('.')}`)
    }

    if (value instanceof Route) {
      let route = value as Route
      if (typeof handlerDef === 'function') {
        handlers[key] = new RouteHandler(route, middleware, handlerDef as any)
      } else if (isObjectRouteHandlerDef(handlerDef)) {
        let routeMiddleware = middleware ? [...middleware] : []
        if (handlerDef.use) {
          routeMiddleware.push(...handlerDef.use)
        }
        handlers[key] = new RouteHandler(
          route,
          routeMiddleware.length > 0 ? routeMiddleware : null,
          handlerDef.handler as any,
        )
      } else {
        throw new Error(`Invalid handler definition for ${keys.join('.')}`)
      }
    } else if (isRouteHandlerMap(handlerDef)) {
      handlers[key] = handlerDef // re-use existing RouteHandlerMap
    } else {
      handlers[key] = _createHandlers(value, handlerDef as any, middleware, keys)
    }
  }

  return handlers
}

// prettier-ignore
export type BuildRouteHandlerMap<T extends RouteMap> = Simplify<{
  [K in keyof T]: (
    T[K] extends Route ? RouteHandler<T[K]> :
    T[K] extends RouteMap ? BuildRouteHandlerMap<T[K]> :
    never
  )
}>

// prettier-ignore
type RouteHandlerDefs<T extends RouteMap> = {
  [K in keyof T]: (
    T[K] extends Route ? RouteHandlerDef<T[K]> :
    T[K] extends RouteMap ? RouteHandlerMap | RouteHandlerDefs<T[K]> :
    never
  )
}

type RouteHandlerDef<R extends Route> = FunctionRouteHandlerDef<R> | ObjectRouteHandlerDef<R>

type FunctionRouteHandlerDef<R extends Route, T = unknown> =
  R extends Route<infer _, infer P extends string> ? RequestHandler<Params<P>, T> : never

interface ObjectRouteHandlerDef<R extends Route, T = unknown> {
  use?: Middleware<RouteParams<R>>[]
  handler: RequestHandler<RouteParams<R>, T>
}

function isObjectRouteHandlerDef<R extends Route>(value: any): value is ObjectRouteHandlerDef<R> {
  return typeof value === 'object' && value != null && 'handler' in value && value.handler != null
}

// Router //////////////////////////////////////////////////////////////////////////////////////////

type RouteHandlerStorage = {
  [K in RequestMethod]: RouteHandler<Route<K, string>>[]
}

export class Router {
  /**
   * Middleware that runs on every request, regardless of the route.
   */
  readonly globalMiddleware: Middleware[] | null

  // prettier-ignore
  #routeHandlers: RouteHandlerStorage = { GET: [], HEAD: [], POST: [], PUT: [], PATCH: [], DELETE: [], OPTIONS: [] }

  constructor(globalMiddleware: Middleware<{}>[] | null = null) {
    this.globalMiddleware = globalMiddleware
  }

  addHandlers(handlers: RouteHandlerMap): void {
    this.#addHandlers(handlers)
  }

  #addHandlers(handlers: RouteHandlerMap): void {
    for (let key in handlers) {
      let handler = handlers[key]

      if (handler instanceof RouteHandler) {
        this.#addRouteHandler(handler)
      } else if (isRouteHandlerMap(handler)) {
        this.#addHandlers(handler)
      }
    }
  }

  #addRouteHandler<M extends RequestMethod>(handler: RouteHandler<Route<M, string>>): void {
    this.#routeHandlers[handler.route.method].push(handler)
  }

  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request =
      typeof input === 'string' || input instanceof URL ? new Request(input, init) : input

    if (!(request.method in this.#routeHandlers)) {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let url =
      typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(request.url)

    let ctx = new RequestContext({}, request, url)

    if (this.globalMiddleware != null) {
      return runMiddleware(this.globalMiddleware, ctx, () => this.#dispatch(ctx))
    }

    return this.#dispatch(ctx)
  }

  async #dispatch(ctx: RequestContext): Promise<Response> {
    let requestMethod = ctx.request.method as RequestMethod

    let response: Response | undefined
    let routeHandlers = this.#routeHandlers[requestMethod]
    if (routeHandlers?.length > 0) {
      response = await this.#runHandlers(ctx, routeHandlers)
    }

    if (response == null && requestMethod === 'HEAD') {
      // Try running GET handlers for HEAD requests
      let getHandlers = this.#routeHandlers['GET']
      if (getHandlers.length > 0) {
        response = await this.#runHandlers(ctx, getHandlers)
      }
    }

    if (response == null) {
      response = new Response('Not Found', { status: 404 })
    }
    if (requestMethod === 'HEAD') {
      return new Response(null, response)
    }

    return response
  }

  async #runHandlers(ctx: RequestContext, handlers: RouteHandler[]): Promise<Response | undefined> {
    let response: Response | undefined

    if (handlers.length > 0) {
      for (let routeHandler of handlers) {
        let match = routeHandler.route.pattern.match(ctx.url)
        if (match != null) {
          Object.assign(ctx.params, match.params)
          response = await routeHandler.dispatch(ctx)
          break
        }
      }
    }

    return response
  }
}

function runMiddleware<P extends AnyParams>(
  middleware: Middleware<P>[],
  context: RequestContext<P>,
  requestHandler: RequestHandler<P, Response>,
): Promise<Response> {
  let index = -1

  async function dispatch(i: number): Promise<Response> {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    let fn = middleware[i]
    if (!fn) return requestHandler(context)

    let nextPromise: Promise<Response> | undefined
    let next: NextFunction = () => {
      nextPromise = dispatch(i + 1)
      return nextPromise
    }

    let response = await fn(context, next)

    // If a response was returned, short-circuit the chain
    if (response instanceof Response) {
      return response
    }

    // If the middleware called next(), use the downstream response
    if (nextPromise != null) {
      return nextPromise
    }

    // If it did not call next(), invoke downstream automatically
    return next()
  }

  return dispatch(0)
}

export function createRouter(handlers: RouteHandlerMap): Router
export function createRouter(middleware: Middleware[], handlers: RouteHandlerMap): Router
export function createRouter(middlewareOrHandlers: any, handlers?: RouteHandlerMap): Router {
  let router: Router
  if (Array.isArray(middlewareOrHandlers)) {
    router = new Router(middlewareOrHandlers)
    router.addHandlers(handlers!)
  } else {
    router = new Router(null)
    router.addHandlers(middlewareOrHandlers)
  }

  return router
}

// Utilities ///////////////////////////////////////////////////////////////////////////////////////

/**
 * Apply middleware at the beginning of all route handlers in a map.
 */
export function applyMiddleware<T extends RouteHandlerMap>(
  middleware: Middleware[],
  handlers: T,
): T {
  let newHandlers: T = {} as any

  for (let key in handlers) {
    let handler = handlers[key]

    if (handler instanceof RouteHandler) {
      newHandlers[key] = new RouteHandler(
        handler.route,
        middleware.concat(handler.middleware ?? []),
        handler.requestHandler,
      ) as any
    } else if (isRouteHandlerMap(handler)) {
      newHandlers[key] = applyMiddleware(middleware, handler)
    }
  }

  return newHandlers
}
