import { RoutePattern } from '@remix-run/route-pattern'

import { AppContext } from './app-context.ts'
import type { Middleware } from './middleware.ts'
import type { RouteHandlers, RouteHandler } from './route-handlers.ts'
import { isRouteStub } from './route-schema.ts'
import type { RequestMethod, RouteSchema } from './route-schema.ts'

export class Route<M extends RequestMethod = RequestMethod, T extends string = string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly middleware: Middleware[]
  readonly handler: RouteHandler<T>

  constructor(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<T>,
    middleware: Middleware[] = [],
  ) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.middleware = middleware
    this.handler = handler
  }
}

const RequestMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

type RouteStorage = {
  [M in RequestMethod]: Route<M, string>[]
}

export class Router<S extends RouteSchema> {
  #routes: RouteStorage = {
    GET: [],
    HEAD: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
    OPTIONS: [],
  }

  constructor(schema: S, handlers: RouteHandlers<S>) {
    this.#createRoutes(schema, handlers)
  }

  #createRoutes<T extends RouteSchema>(schema: T, handlers: RouteHandlers<T>): void {
    for (let key in schema) {
      let value = schema[key]
      let handler = handlers[key]

      if (typeof value === 'string' || value instanceof RoutePattern) {
        this.addAnyRoute(value, handler)
      } else if (isRouteStub(value)) {
        if (value.method == null) {
          this.addAnyRoute(value.pattern, handler)
        } else {
          this.addRoute(value.method, value.pattern, handler)
        }
      } else if (typeof value === 'object' && value != null) {
        // value is nested RouteSchema
        this.#createRoutes(value, handlers[key] as any)
      } else {
        throw new Error('Invalid route schema')
      }
    }
  }

  addRoute<M extends RequestMethod, T extends string>(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): void {
    this.#routes[method].push(new Route(method, pattern, handler))
  }

  addAnyRoute<T extends string>(pattern: T | RoutePattern<T>, handler: RouteHandler<T>): void {
    for (let method of RequestMethods) {
      this.addRoute(method, pattern, handler)
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
          response = await route.handler({
            context: new AppContext(),
            request,
            params: match.params,
            url,
          })
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

export function createRouter<S extends RouteSchema>(
  schema: S,
  handlers: RouteHandlers<S>,
): Router<S> {
  return new Router(schema, handlers)
}
