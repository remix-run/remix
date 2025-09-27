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
  readonly methods: M[]
  readonly pattern: RoutePattern<P>

  constructor(methods: M | M[], pattern: P | RoutePattern<P>) {
    this.methods = Array.isArray(methods) ? methods : [methods]
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

    if (routeDef == null) {
      throw new Error(`Missing route definition for ${keys.join('.')}`)
    }

    if (typeof routeDef === 'string' || routeDef instanceof RoutePattern) {
      routes[key] = new Route(RequestMethods, base.join(routeDef))
    } else if (isMultiMethodRouteDef(routeDef)) {
      routes[key] = new Route(routeDef.methods, base.join(routeDef.pattern))
    } else if (isSingleMethodRouteDef(routeDef)) {
      routes[key] = new Route(routeDef.method ?? RequestMethods, base.join(routeDef.pattern))
    } else if (typeof routeDef === 'object' && routeDef != null) {
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

type RouteDefs = {
  [key: string]: RouteDef | RouteDefs
}

type RouteDef<P extends string = string> =
  | P
  | RoutePattern<P>
  | MultiMethodRouteDef<P>
  | SingleMethodRouteDef<P>

type MultiMethodRouteDef<P extends string = string> = {
  methods: RequestMethod[]
  pattern: P | RoutePattern<P>
}

function isMultiMethodRouteDef<P extends string>(value: any): value is MultiMethodRouteDef<P> {
  return (
    typeof value === 'object' &&
    value != null &&
    'methods' in value &&
    Array.isArray(value.methods) &&
    'pattern' in value &&
    value.pattern != null
  )
}

type SingleMethodRouteDef<P extends string = string> = {
  method?: RequestMethod
  pattern: P | RoutePattern<P>
}

function isSingleMethodRouteDef<P extends string>(value: any): value is SingleMethodRouteDef<P> {
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
  readonly handlers: NormalizedHandlerMap<R>

  constructor(
    route: R,
    middleware: Middleware<RouteParams<R>>[] | null,
    handlers: NormalizedHandlerMap<R>,
  ) {
    this.route = route
    this.middleware = middleware
    this.handlers = handlers
  }

  dispatch(ctx: RequestContext<RouteParams<R>>): Response | Promise<Response> {
    if (this.middleware != null) {
      return runMiddleware(this.middleware, ctx, () => this.#handleRequest(ctx))
    }

    return this.#handleRequest(ctx)
  }

  #handleRequest(ctx: RequestContext<RouteParams<R>>): Response | Promise<Response> {
    let method = ctx.request.method as RequestMethod
    let requestHandler = this.handlers[method]

    if (requestHandler == null) {
      throw new Error(`Missing request handler for ${method}`)
    }

    return requestHandler(ctx) as Response | Promise<Response>
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
  let middleware: Middleware[] | null = null
  if (Array.isArray(middlewareOrHandlerDefs)) {
    if (handlerDefs == null) {
      throw new Error('Missing handler definitions')
    }

    middleware = middlewareOrHandlerDefs
  } else {
    handlerDefs = middlewareOrHandlerDefs
  }

  return _createHandlers(routes, handlerDefs!, middleware)
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
      let handlerMap: NormalizedHandlerMap<Route>

      if (typeof handlerDef === 'function') {
        // Single function handler - use for all methods
        handlerMap = createSingleMethodHandlerMap(route, null, handlerDef as any)
      } else if (isSingleMethodRouteHandlerDef(handlerDef)) {
        // Single method handler definition with middleware
        handlerMap = createSingleMethodHandlerMap(
          route,
          handlerDef.use ?? null,
          handlerDef.handler as any,
        )
      } else {
        // Multi-method handler definition
        handlerMap = createMultiMethodHandlerMap(route, handlerDef as any)

        // Verify all required method handlers are present
        for (let method of route.methods) {
          // HEAD and OPTIONS are optional
          if (method !== 'HEAD' && method !== 'OPTIONS' && handlerMap[method] == null) {
            throw new Error(`Missing request handler for ${method} on ${keys.join('.')}`)
          }
        }
      }

      handlers[key] = new RouteHandler(
        route,
        concatMiddleware(middleware, handlerMap.use),
        handlerMap,
      )
    } else if (isRouteHandlerMap(handlerDef)) {
      handlers[key] = handlerDef // re-use existing RouteHandlerMap
    } else {
      handlers[key] = _createHandlers(value, handlerDef as any, middleware, keys)
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

function isSingleMethodRouteHandlerDef<R extends Route>(
  value: any,
): value is SingleMethodRouteHandlerDef<R> {
  return typeof value === 'object' && value != null && 'handler' in value && value.handler != null
}

// prettier-ignore
type MultiMethodRouteHandlerDef<R extends Route, T = unknown> =
  { use?: Middleware<RouteParams<R>>[] } & (
    R extends Route<infer M extends RequestMethod, infer P extends string> ? (
      ('GET' extends M ? { GET: RequestHandler<Params<P>, T> } | { get: RequestHandler<Params<P>, T> } : {}) &
      ('HEAD' extends M ? { HEAD?: RequestHandler<Params<P>, T> } | { head?: RequestHandler<Params<P>, T> } : {}) & // optional
      ('POST' extends M ? { POST: RequestHandler<Params<P>, T> } | { post: RequestHandler<Params<P>, T> } : {}) &
      ('PUT' extends M ? { PUT: RequestHandler<Params<P>, T> } | { put: RequestHandler<Params<P>, T> } : {}) &
      ('PATCH' extends M ? { PATCH: RequestHandler<Params<P>, T> } | { patch: RequestHandler<Params<P>, T> } : {}) &
      ('DELETE' extends M ? { DELETE: RequestHandler<Params<P>, T> } | { delete: RequestHandler<Params<P>, T> } : {}) &
      ('OPTIONS' extends M ? { OPTIONS?: RequestHandler<Params<P>, T> } | { options?: RequestHandler<Params<P>, T> } : {}) // optional
    ) :
    never
  )

/**
 * A normalized runtime-friendly handler map that stores handlers by
 * request method names.
 */
type NormalizedHandlerMap<R extends Route, T = unknown> = {
  use?: Middleware<RouteParams<R>>[]
} & (R extends Route<infer M extends RequestMethod, infer P extends string>
  ? {
      [K in M]: RequestHandler<Params<P>, T>
    } & {
      // Optional methods that might not be provided
      HEAD?: RequestHandler<Params<P>, T>
      OPTIONS?: RequestHandler<Params<P>, T>
    }
  : never)

function createSingleMethodHandlerMap(
  route: Route,
  middleware: Middleware<any>[] | null,
  handler: RequestHandler<any>,
): NormalizedHandlerMap<Route> {
  let map: any = {
    use: middleware,
  }

  // Assign the same handler to all supported methods
  for (let method of route.methods) {
    map[method] = handler
  }

  return map
}

function createMultiMethodHandlerMap(route: Route, handlerDef: any): NormalizedHandlerMap<Route> {
  let map: any = {
    use: handlerDef.use,
  }

  // Convert both uppercase and lowercase method names to uppercase
  for (let method of route.methods) {
    let handler = (handlerDef as any)[method] ?? (handlerDef as any)[method.toLowerCase()]
    if (handler != null) {
      map[method] = handler
    }
  }

  // If HEAD is supported but no HEAD handler is provided,
  // use the GET handler if one is available
  if (route.methods.includes('HEAD') && !map.HEAD) {
    let getHandler = map.GET ?? (handlerDef as any).get ?? (handlerDef as any).GET
    if (getHandler != null) {
      map.HEAD = getHandler
    }
  }

  return map
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
    for (let method of handler.route.methods) {
      this.#routeHandlers[method].push(handler)
    }
  }

  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request =
      typeof input === 'string' || input instanceof URL ? new Request(input, init) : input

    if (!(request.method in this.#routeHandlers)) {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // prettier-ignore
    let url =
      typeof input === 'string' ? new URL(input) :
      input instanceof URL ? input :
      new URL(request.url)

    let context = new RequestContext({}, request, url)

    if (this.globalMiddleware != null) {
      return runMiddleware(this.globalMiddleware, context, () => this.#dispatch(context))
    }

    return this.#dispatch(context)
  }

  async #dispatch(context: RequestContext): Promise<Response> {
    let response: Response | undefined

    let routeHandlers = this.#routeHandlers[context.request.method as RequestMethod]
    if (routeHandlers != null && routeHandlers.length > 0) {
      for (let routeHandler of routeHandlers) {
        let match = routeHandler.route.pattern.match(context.url)

        if (match != null) {
          Object.assign(context.params, match.params)
          response = await routeHandler.dispatch(context)
          break
        }
      }
    }

    if (response == null) {
      response = new Response('Not Found', { status: 404 })
    }
    if (context.request.method === 'HEAD') {
      return new Response(null, response)
    }

    return response
  }
}

function runMiddleware<P extends AnyParams>(
  middleware: Middleware<P>[],
  context: RequestContext<P>,
  routeHandler: () => Response | Promise<Response>,
): Promise<Response> {
  let index = -1

  async function dispatch(i: number): Promise<Response> {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    let fn = middleware[i]
    if (!fn) return routeHandler()

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
  let middleware: Middleware[] | null = null
  if (Array.isArray(middlewareOrHandlers)) {
    if (handlers == null) {
      throw new Error('Missing route handlers')
    }

    middleware = middlewareOrHandlers
  } else {
    handlers = middlewareOrHandlers
  }

  let router = new Router(middleware)

  if (handlers != null) {
    router.addHandlers(handlers)
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
      // Create a new normalized handler map with the additional middleware
      let newHandlerMap = { ...handler.handlers }
      newHandlerMap.use = middleware.concat(handler.middleware ?? [])

      newHandlers[key] = new RouteHandler(handler.route, newHandlerMap.use, newHandlerMap) as any
    } else if (isRouteHandlerMap(handler)) {
      newHandlers[key] = applyMiddleware(middleware, handler)
    }
  }

  return newHandlers
}
