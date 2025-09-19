import {
  isRouteStub,
  type RouteDef,
  type RouteMethod,
  type RouteSchema,
  type RouteStub,
} from './route-schema.ts'
import type { RouteHandler } from './route-handler.ts'
import type { RoutePatterns } from './route-patterns.ts'

export type RouteHandlers<S extends RouteSchema> = {
  [K in keyof S]: HandlerForRouteDef<S[K]>
}

// prettier-ignore
export type HandlerForRouteDef<T extends RouteDef> =
  T extends string ? RouteHandler<T> :
  T extends RoutePattern<infer P extends string> ? HandlerForRouteDef<P> :
  T extends RouteStub<infer P extends string> ? HandlerForRouteDef<P> :
  T extends RouteSchema ?
    // If T is the bare RouteSchema, exclude to avoid recursion and union widening
    [RouteSchema] extends [T] ? never :
    RouteHandlers<T> :
  never

export class Route<M extends RouteMethod = RouteMethod, T extends string = string> {
  readonly method: M
  readonly pattern: RoutePattern<T>
  readonly handler: RouteHandler<T>

  constructor(method: M, pattern: T | RoutePattern<T>, handler: RouteHandler<T>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
    this.handler = handler
  }
}

export class Router<S extends RouteSchema> {
  readonly schema: RouteSchema

  #routes: {
    GET: Route<'GET', string>[]
    HEAD: Route<'HEAD', string>[]
    POST: Route<'POST', string>[]
    PUT: Route<'PUT', string>[]
    PATCH: Route<'PATCH', string>[]
    DELETE: Route<'DELETE', string>[]
    OPTIONS: Route<'OPTIONS', string>[]
  } = {
    GET: [],
    HEAD: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
    OPTIONS: [],
  }

  constructor(schema: S, handlers: RouteHandlers<S>) {
    this.schema = schema
    this.#createRoutes(schema, handlers)
  }

  #createRoutes(schema: S, handlers: RouteHandlers<S>): void {
    for (let [key, value] of Object.entries(schema)) {
      if (typeof value === 'string') {
        this.addRoute('GET', value, handlers[key])
        this.addRoute('HEAD', value, handlers[key])
        this.addRoute('POST', value, handlers[key])
        this.addRoute('PUT', value, handlers[key])
        this.addRoute('PATCH', value, handlers[key])
        this.addRoute('DELETE', value, handlers[key])
        this.addRoute('OPTIONS', value, handlers[key])
      } else if (value instanceof RoutePattern) {
        this.addRoute('GET', value, handlers[key])
        this.addRoute('HEAD', value, handlers[key])
        this.addRoute('POST', value, handlers[key])
        this.addRoute('PUT', value, handlers[key])
        this.addRoute('PATCH', value, handlers[key])
        this.addRoute('DELETE', value, handlers[key])
        this.addRoute('OPTIONS', value, handlers[key])
      } else if (isRouteStub(value)) {
        this.addRoute(value.method as RouteMethod, value.pattern as RoutePattern, handlers[key])
      } else if (typeof value === 'object' && value != null) {
        // value is nested RouteSchema
        this.#createRoutes(value as S, handlers[key] as any)
      } else {
        throw new Error('Invalid route schema')
      }
    }
  }

  addRoute<M extends RouteMethod, T extends string>(
    method: M,
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<M, T> {
    let route = new Route(method, pattern, handler)
    let routes = this.#routes[method] as Route<M, T>[]
    routes.push(route)
    return route
  }

  async fetch(request: string | URL | Request): Promise<Response> {
    if (typeof request === 'string' || request instanceof URL) {
      request = new Request(request)
    }

    let method = request.method.toUpperCase() as RouteMethod

    if (!(method in this.#routes)) {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let url =
      typeof request === 'string'
        ? new URL(request)
        : request instanceof URL
          ? request
          : new URL(request.url)

    let routes = this.#routes[method]
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
      if (method === 'HEAD') {
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

////////////////////////////////////////////////////////////////////////

import { createHrefBuilder, RoutePattern } from '@remix-run/route-pattern'
import { AppContext } from './app-context.ts'

let routes = {
  home: '/',
  about: '/about',
  products: {
    index: '/products',
    edit: new RoutePattern('/products/:id/edit'),
  },
  api: {
    users: { method: 'GET', pattern: new RoutePattern('/api/users') },
  },
} as const

type P = RoutePatterns<typeof routes>

let href = createHrefBuilder<P>()

href(routes.products.edit, { id: '1' })

let router = createRouter(routes, {
  home() {
    return new Response('Home')
  },
  about() {
    return new Response('About')
  },
  products: {
    index() {
      return new Response('Products')
    },
    edit({ params }) {
      return new Response(`Edit ${params.id}`)
    },
  },
  api: {
    users({ params }) {
      return new Response('Users')
    },
  },
})
