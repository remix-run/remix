import { RoutePattern } from '@remix-run/route-pattern'
import type { RouteMap } from '@remix-run/route-pattern'

import { RequestContext } from './request-context.ts'
import { RequestMethods } from './request-methods.ts'
import type { RequestMethod } from './request-methods.ts'

// Middleware //////////////////////////////////////////////////////////////////////////////////////

export interface Middleware<T extends string = string> {
  (ctx: RequestContext<T>, next: NextFunction): Response | Promise<Response> | void | Promise<void>
}

export type NextFunction = () => Promise<Response>

// Route handlers //////////////////////////////////////////////////////////////////////////////////

// prettier-ignore
export type RouteHandlers<T extends RouteMap> = {
  [K in keyof T]: (
    T[K] extends RoutePattern<infer P extends string> ? RouteHandler<P> :
    T[K] extends RouteMap ? RouteHandlers<T[K]> :
    never
  )
}

export type RouteHandler<T extends string> =
  | RouteHandlerFunction<T>
  | GenericRouteHandler<T>
  | ShorthandRouteHandler<T>

interface RouteHandlerFunction<T extends string> {
  (ctx: RequestContext<T>): Response | Promise<Response>
}

interface GenericRouteHandler<T extends string> {
  use?: Middleware<T>[]
  method?: RequestMethod
  methods?: RequestMethod[]
  handler: RouteHandlerFunction<T>
  // Explicitly exclude shorthand handler properties
  get?: never
  head?: never
  post?: never
  put?: never
  patch?: never
  delete?: never
  options?: never
}

interface ShorthandRouteHandler<T extends string> {
  use?: Middleware<T>[]
  get?: RouteHandlerFunction<T>
  head?: RouteHandlerFunction<T>
  post?: RouteHandlerFunction<T>
  put?: RouteHandlerFunction<T>
  patch?: RouteHandlerFunction<T>
  delete?: RouteHandlerFunction<T>
  options?: RouteHandlerFunction<T>
  // Explicitly exclude generic handler properties
  handler?: never
  method?: never
  methods?: never
}

/**
 * Create a set of route handlers, optionally fronted by generic middleware.
 */
export function createHandlers<T extends RouteMap>(
  routes: T,
  handlers: RouteHandlers<T>,
): RouteHandlers<T>
export function createHandlers<T extends RouteMap>(
  routes: T,
  middleware: Middleware[],
  handlers: RouteHandlers<T>,
): RouteHandlers<T>
export function createHandlers<T extends RouteMap>(
  routes: T,
  middlewareOrHandlers: any,
  handlers?: RouteHandlers<T>,
): RouteHandlers<T> {
  let middleware: Middleware[] | undefined
  if (Array.isArray(middlewareOrHandlers)) {
    middleware = middlewareOrHandlers
  } else {
    handlers = middlewareOrHandlers
  }

  if (handlers == null) {
    throw new Error('Missing route handlers')
  }
  if (middleware != null) {
    handlers = useMiddleware(middleware, routes, handlers)
  }

  return handlers
}

function useMiddleware<T extends RouteMap>(
  middleware: Middleware[],
  routes: T,
  handlers: RouteHandlers<T>,
): RouteHandlers<T> {
  let newHandlers: RouteHandlers<T> = {} as any

  for (let key in routes) {
    let value = routes[key]
    let handler = handlers[key]

    if (value instanceof RoutePattern) {
      if (typeof handler === 'function') {
        newHandlers[key] = { use: middleware, handler } as any
      } else {
        newHandlers[key] = {
          ...handler,
          use:
            handler.use != null && Array.isArray(handler.use)
              ? [...middleware, ...handler.use]
              : middleware,
        } as any
      }
    } else {
      // value is a nested RouteSchema
      newHandlers[key] = useMiddleware(middleware, value, handler as any) as any
    }
  }

  return newHandlers
}

// Route storage ///////////////////////////////////////////////////////////////////////////////////

type RouteStorage = {
  [M in RequestMethod]: Route<M, string>[]
}

class Route<M extends RequestMethod = RequestMethod, T extends string = string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly handler: RouteHandlerFunction<T>
  readonly middleware: Middleware<T>[] | null

  constructor(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandlerFunction<T>,
    middleware: Middleware<T>[] | null = null,
  ) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.handler = handler
    this.middleware = middleware
  }
}

// Router //////////////////////////////////////////////////////////////////////////////////////////

export function createRouter(): Router
export function createRouter<T extends RouteMap>(routes: T, handlers: RouteHandlers<T>): Router
export function createRouter<T extends RouteMap>(
  routes: T,
  middleware: Middleware[],
  handlers: RouteHandlers<T>,
): Router
export function createRouter<T extends RouteMap>(
  routes?: T,
  middlewareOrHandlers?: any,
  handlers?: RouteHandlers<T>,
): Router {
  let middleware: Middleware[] | undefined
  if (Array.isArray(middlewareOrHandlers)) {
    middleware = middlewareOrHandlers
  } else {
    handlers = middlewareOrHandlers
  }

  let router = new Router()

  if (routes != null && handlers != null) {
    if (middleware != null) {
      router.addRoutes(routes, middleware, handlers)
    } else {
      router.addRoutes(routes, handlers)
    }
  }

  return router
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

  addRoutes<T extends RouteMap>(routes: T, handlers: RouteHandlers<T>): void
  addRoutes<T extends RouteMap>(
    routes: T,
    middleware: Middleware[],
    handlers: RouteHandlers<T>,
  ): void
  addRoutes<T extends RouteMap>(
    routes: T,
    middlewareOrHandlers: any,
    handlers?: RouteHandlers<T>,
  ): void {
    let middleware: Middleware[] | undefined
    if (Array.isArray(middlewareOrHandlers)) {
      middleware = middlewareOrHandlers
    } else {
      handlers = middlewareOrHandlers
    }

    this.#addRoutes(
      routes,
      middleware == null ? handlers! : useMiddleware(middleware, routes, handlers!),
    )
  }

  #addRoutes<T extends RouteMap>(
    routes: T,
    handlers: RouteHandlers<T>,
    parentKeys: string[] = [],
  ): void {
    for (let key in routes) {
      let keys = [...parentKeys, key]
      let value = routes[key]
      let handler = handlers[key] as RouteHandlerFunction<string> | RouteHandler<string>

      if (handler == null) {
        throw new Error(`Missing handler for route ${keys.join('.')}`)
      }

      if (value instanceof RoutePattern) {
        if (typeof handler === 'function') {
          this.addAnyRoute(value, handler as any)
          continue
        }

        let handlerAdded = false

        if ('handler' in handler && handler.handler != null) {
          // Generic handler
          let methods = handler.methods ?? (handler.method ? [handler.method] : RequestMethods)
          for (let method of methods) {
            this.addRoute(method, value, handler.handler, handler.use)
            handlerAdded = true
          }
        } else {
          // HTTP method-specific handlers
          for (let method of RequestMethods) {
            let methodHandler = handler[method.toLowerCase() as keyof ShorthandRouteHandler<string>]
            if (typeof methodHandler === 'function') {
              this.addRoute(method, value, methodHandler, handler.use)
              handlerAdded = true
            }
          }
        }

        if (!handlerAdded) {
          throw new Error(`No handler for route ${keys.join('.')}`)
        }
      } else if (typeof value === 'object' && value != null) {
        // pattern is nested RouteSchema
        this.#addRoutes(value, handler as any, keys)
      } else {
        throw new Error('Invalid route schema')
      }
    }
  }

  addRoute<M extends RequestMethod, T extends string>(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandlerFunction<T>,
    middleware: Middleware<T>[] | null = null,
  ): void {
    this.#routes[method].push(new Route(method, pattern, handler, middleware))
  }

  addAnyRoute<T extends string>(
    pattern: T | RoutePattern<T>,
    handler: RouteHandlerFunction<T>,
    middleware: Middleware<T>[] | null = null,
  ): void {
    for (let method of RequestMethods) {
      this.addRoute(method, pattern, handler, middleware)
    }
  }

  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request =
      typeof input === 'string' || input instanceof URL ? new Request(input, init) : input

    if (!(request.method in this.#routes)) {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let url =
      typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(request.url)

    let routes = this.#routes[request.method as RequestMethod]
    let response: Response | undefined
    if (routes != null && routes.length > 0) {
      for (let route of routes) {
        let match = route.pattern.match(request.url)

        if (match != null) {
          let context = new RequestContext(match.params, request, url)

          if (route.middleware != null) {
            response = await runMiddleware(route.middleware, context, async () => {
              return await route.handler(context)
            })
          } else {
            response = await route.handler(context)
          }

          break
        }
      }
    }

    if (response != null) {
      if (request.method === 'HEAD') {
        return new Response(null, response)
      }

      return response
    }

    return new Response('Not Found', { status: 404 })
  }
}

function runMiddleware(
  middleware: Middleware[],
  context: RequestContext,
  routeHandler: () => Promise<Response>,
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
