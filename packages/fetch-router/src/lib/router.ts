import { RoutePattern } from '@remix-run/route-pattern'

import type { Middleware, NextFunction } from './middleware.ts'
import type { RouteHandler } from './route-handler.ts'
import type { RouteSchema } from './route-schema.ts'
import { RequestContext } from './request-context.ts'

// Request methods /////////////////////////////////////////////////////////////////////////////////

export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
export const RequestMethods: RequestMethod[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]

// Route handlers //////////////////////////////////////////////////////////////////////////////////

// prettier-ignore
export type RouteHandlers<T extends RouteSchema> = {
  [K in keyof T]: (
    T[K] extends RoutePattern<infer P extends string> ? RouteHandler<P> | EnhancedRouteHandler<P> :
    T[K] extends RouteSchema ? RouteHandlers<T[K]> :
    never
  )
}

type EnhancedRouteHandler<T extends string> = GenericRouteHandler<T> | ShorthandRouteHandler<T>

interface GenericRouteHandler<T extends string> {
  use?: Middleware[]
  method?: RequestMethod
  methods?: RequestMethod[]
  handler: RouteHandler<T>
  // Explicitly exclude shorthand method properties
  get?: never
  head?: never
  post?: never
  put?: never
  patch?: never
  delete?: never
  options?: never
}

interface ShorthandRouteHandler<T extends string> {
  use?: Middleware[]
  get?: RouteHandler<T>
  head?: RouteHandler<T>
  post?: RouteHandler<T>
  put?: RouteHandler<T>
  patch?: RouteHandler<T>
  delete?: RouteHandler<T>
  options?: RouteHandler<T>
  // Explicitly exclude generic handler properties
  handler?: never
  method?: never
  methods?: never
}

// Route storage ///////////////////////////////////////////////////////////////////////////////////

class Route<M extends RequestMethod = RequestMethod, T extends string = string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly handler: RouteHandler<T>
  readonly middleware: Middleware[] | null

  constructor(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<T>,
    middleware: Middleware[] | null = null,
  ) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.handler = handler
    this.middleware = middleware
  }
}

type RouteStorage = {
  [M in RequestMethod]: Route<M, string>[]
}

// Router //////////////////////////////////////////////////////////////////////////////////////////

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

  addRoutes<T extends RouteSchema>(schema: T, handlers: RouteHandlers<T>): void {
    this.#addRoutes(schema, handlers)
  }

  #addRoutes<T extends RouteSchema>(
    routes: T,
    handlers: RouteHandlers<T>,
    parentKeys: string[] = [],
  ): void {
    for (let key in routes) {
      let keys = [...parentKeys, key]
      let pattern = routes[key]
      let handler = handlers[key] as RouteHandler<string> | EnhancedRouteHandler<string>

      if (handler == null) {
        throw new Error(`Missing handler for route ${keys.join('.')}`)
      }

      if (pattern instanceof RoutePattern) {
        if (typeof handler === 'function') {
          this.addAnyRoute(pattern, handler as any)
          continue
        }

        let handlerAdded = false

        if ('handler' in handler && handler.handler != null) {
          // Generic handler
          let methods = handler.methods ?? (handler.method ? [handler.method] : RequestMethods)
          for (let method of methods) {
            this.addRoute(method, pattern, handler.handler, handler.use)
            handlerAdded = true
          }
        } else {
          handler = handler as ShorthandRouteHandler<string>

          // HTTP method-specific handlers
          if (handler.get != null) {
            this.addRoute('GET', pattern, handler.get, handler.use)
            handlerAdded = true
          }
          if (handler.head != null) {
            this.addRoute('HEAD', pattern, handler.head, handler.use)
            handlerAdded = true
          }
          if (handler.post != null) {
            this.addRoute('POST', pattern, handler.post, handler.use)
            handlerAdded = true
          }
          if (handler.put != null) {
            this.addRoute('PUT', pattern, handler.put, handler.use)
            handlerAdded = true
          }
          if (handler.patch != null) {
            this.addRoute('PATCH', pattern, handler.patch, handler.use)
            handlerAdded = true
          }
          if (handler.delete != null) {
            this.addRoute('DELETE', pattern, handler.delete, handler.use)
            handlerAdded = true
          }
          if (handler.options != null) {
            this.addRoute('OPTIONS', pattern, handler.options, handler.use)
            handlerAdded = true
          }
        }

        if (!handlerAdded) {
          throw new Error(`No handler for route ${keys.join('.')}`)
        }
      } else if (typeof pattern === 'object' && pattern != null) {
        // value is nested RouteSchema
        this.#addRoutes(pattern, handlers[key] as any, keys)
      } else {
        throw new Error('Invalid route schema')
      }
    }
  }

  addRoute<M extends RequestMethod, T extends string>(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<T>,
    middleware: Middleware[] | null = null,
  ): void {
    this.#routes[method].push(new Route(method, pattern, handler, middleware))
  }

  addAnyRoute<T extends string>(
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<T>,
    middleware: Middleware[] | null = null,
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
          let context = new RequestContext(request, match.params, url)

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

export function createRouter<T extends RouteSchema>(
  routes?: T,
  handlers?: RouteHandlers<T>,
): Router {
  let router = new Router()

  if (routes != null && handlers != null) {
    router.addRoutes(routes, handlers)
  }

  return router
}
