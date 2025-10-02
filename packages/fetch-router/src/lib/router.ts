import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'
import type { Matcher, Params } from '@remix-run/route-pattern'

import { RequestContext, runMiddleware } from './request-handler.ts'
import type { Middleware, RequestHandler, RequestMethod } from './request-handler.ts'
import { Route } from './route-map.ts'
import type { RouteMap } from './route-map.ts'

export interface RouterOptions {
  /**
   * The default request handler that runs when no route matches.
   * Default is a 404.
   */
  defaultHandler?: RequestHandler
  /**
   * The matcher to use for matching routes.
   * Default is a `new RegExpMatcher()`.
   */
  matcher?: Matcher<MatchData>
}

// prettier-ignore
type HandlerMap<T> = {
  [K in keyof T]: (
    T[K] extends Route<any, infer P> ? RequestHandler<Params<P>> :
    T[K] extends RouteMap ? HandlerMap<T[K]> :
    never
  )
}

type MatchData =
  | {
      method: RequestMethod | 'ANY'
      middleware: Middleware[] | undefined
      handler: RequestHandler<any>
    }
  | {
      middleware: Middleware[] | undefined
      prefix: string
      router: Router
    }

function defaultHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

/**
 * Create a new router.
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options)
}

export class Router {
  #defaultHandler: RequestHandler
  #matcher: Matcher<MatchData>
  #middleware: Middleware[] | undefined

  constructor(options?: RouterOptions) {
    this.#defaultHandler = options?.defaultHandler ?? defaultHandler
    this.#matcher = options?.matcher ?? new RegExpMatcher()
  }

  /**
   * Fetch a response from the router.
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request = input instanceof Request ? input : new Request(input, init)
    let response = await this.dispatch(request)

    if (response == null) {
      let context = new RequestContext(request, new URL(request.url), {})
      response = await this.#defaultHandler(context)
    }

    return response
  }

  /**
   * Low-level method that runs a request through the router and returns a response or null if no
   * match is found.
   *
   * Note: This method does not invoke the router's default handler when no match is found. If
   * that's what you want, use `router.fetch()` instead.
   */
  async dispatch(
    context: RequestContext | Request,
    upstreamMiddleware?: Middleware[],
  ): Promise<Response | null> {
    let request = context instanceof Request ? context : context.request
    let url = context instanceof Request ? new URL(request.url) : context.url

    for (let match of this.#matcher.matchAll(url)) {
      if ('method' in match.data) {
        let { method, middleware, handler } = match.data

        if (method === request.method || method === 'ANY') {
          let allMiddleware =
            middleware == null
              ? upstreamMiddleware
              : upstreamMiddleware == null
                ? middleware
                : upstreamMiddleware.concat(middleware)
          let downstreamContext =
            context instanceof Request
              ? new RequestContext(request, match.url, match.params)
              : new RequestContext(request, match.url, match.params, context.storage)

          return allMiddleware != null
            ? await runMiddleware(allMiddleware, downstreamContext, handler)
            : await handler(downstreamContext)
        }
      } else {
        let { middleware, prefix, router } = match.data

        let allMiddleware =
          middleware == null
            ? upstreamMiddleware
            : upstreamMiddleware == null
              ? middleware
              : upstreamMiddleware.concat(middleware)
        // Strip the prefix from context.url.pathname
        let downstreamUrl = new URL(match.url)
        downstreamUrl.pathname = downstreamUrl.pathname.slice(prefix.length)
        let downstreamContext =
          context instanceof Request
            ? new RequestContext(request, downstreamUrl)
            : new RequestContext(request, downstreamUrl, {}, context.storage)

        let response = await router.dispatch(downstreamContext, allMiddleware)

        // If we get a response from the downstream router, use it.
        // Otherwise, continue to the next match.
        if (response != null) {
          return response
        }
      }
    }

    return null
  }

  /**
   * Mount a router at a given pathname prefix in the current router.
   */
  mount(router: Router): void
  mount(pathnamePrefix: string, router: Router): void
  mount(arg: string | Router, router?: Router): void {
    let pathnamePrefix = '/'
    if (typeof arg === 'string') {
      if (!arg.startsWith('/') || arg.includes('?') || arg.includes(':') || arg.includes('*')) {
        throw new Error(
          `Invalid mount prefix: "${arg}"; prefix must start with "/" and contain only static segments`,
        )
      }

      pathnamePrefix = arg
    } else {
      router = arg
    }

    // Add an optional catch-all segment so the pattern matches any pathname
    // that starts with the prefix.
    let pattern = pathnamePrefix.replace(/\/*$/, '(/*)')

    this.#matcher.add(pattern, {
      middleware: this.#middleware?.slice(0) ?? undefined,
      prefix: pathnamePrefix,
      router: router!,
    })
  }

  /**
   * Add middleware to the router.
   */
  use(middleware: Middleware | Middleware[]): void {
    this.#middleware = (this.#middleware ?? []).concat(middleware)
  }

  /**
   * The number of routes in the router.
   */
  get size(): number {
    return this.#matcher.size
  }

  // Bulk route mapping

  map<M extends RequestMethod, P extends string>(
    route: Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  map<M extends RequestMethod, P extends string>(
    route: Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  map<T extends RouteMap>(routes: T, handlers: HandlerMap<T>): void
  map<T extends RouteMap>(routes: T, middleware: Middleware[], handlers: HandlerMap<T>): void
  map(routeOrRoutes: any, middlewareOrHandlers: any, handlers?: any): void {
    // Detect if middlewareOrHandlers is actually middleware array
    let routeMiddleware: Middleware[] | undefined
    let actualHandlers: any

    if (handlers !== undefined) {
      // Called with middleware: map(routes, middleware, handlers)
      routeMiddleware = middlewareOrHandlers
      actualHandlers = handlers
    } else {
      // Called without middleware: map(routes, handlers)
      routeMiddleware = undefined
      actualHandlers = middlewareOrHandlers
    }

    if (routeOrRoutes instanceof Route) {
      // Single route mapping
      if (routeMiddleware && routeMiddleware.length > 0) {
        this.#route(routeOrRoutes.method, routeOrRoutes.pattern, routeMiddleware, actualHandlers)
      } else {
        this.#route(routeOrRoutes.method, routeOrRoutes.pattern, actualHandlers)
      }
    } else {
      // Bulk route mapping
      for (let key in routeOrRoutes) {
        let route = routeOrRoutes[key]
        let handler = actualHandlers[key]

        if (route instanceof Route) {
          if (routeMiddleware && routeMiddleware.length > 0) {
            this.#route(route.method, route.pattern, routeMiddleware, handler)
          } else {
            this.#route(route.method, route.pattern, handler)
          }
        } else {
          // Recursive mapping - pass middleware down to nested routes
          if (routeMiddleware && routeMiddleware.length > 0) {
            this.map(route, routeMiddleware, handler)
          } else {
            this.map(route, handler)
          }
        }
      }
    }
  }

  // Individual route mapping

  any<P extends string>(
    pattern: P | RoutePattern<P> | Route<RequestMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  any<P extends string>(
    pattern: P | RoutePattern<P> | Route<RequestMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  any<P extends string>(
    pattern: P | RoutePattern<P> | Route<RequestMethod, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('ANY', pattern, middlewareOrHandler as any, handler as any)
  }

  get<M extends 'GET' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  get<M extends 'GET' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  get<M extends 'GET' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('GET', pattern, middlewareOrHandler as any, handler as any)
  }

  post<M extends 'POST' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  post<M extends 'POST' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  post<M extends 'POST' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('POST', pattern, middlewareOrHandler as any, handler as any)
  }

  put<M extends 'PUT' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  put<M extends 'PUT' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  put<M extends 'PUT' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('PUT', pattern, middlewareOrHandler as any, handler as any)
  }

  patch<M extends 'PATCH' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  patch<M extends 'PATCH' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  patch<M extends 'PATCH' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('PATCH', pattern, middlewareOrHandler as any, handler as any)
  }

  delete<M extends 'DELETE' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  delete<M extends 'DELETE' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  delete<M extends 'DELETE' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('DELETE', pattern, middlewareOrHandler as any, handler as any)
  }

  options<M extends 'OPTIONS' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  options<M extends 'OPTIONS' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  options<M extends 'OPTIONS' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('OPTIONS', pattern, middlewareOrHandler as any, handler as any)
  }

  head<M extends 'HEAD' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  head<M extends 'HEAD' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  head<M extends 'HEAD' | RequestMethod, P extends string>(
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    this.#route('HEAD', pattern, middlewareOrHandler as any, handler as any)
  }

  #route<M extends RequestMethod | 'ANY', P extends string>(
    method: M,
    pattern: P | RoutePattern<P> | Route<any, P>,
    middlewareOrHandler: Middleware[] | RequestHandler<Params<P>>,
    handler?: RequestHandler<Params<P>>,
  ): void {
    let routeHandler: RequestHandler<Params<P>>
    let routeMiddleware: Middleware[] | undefined

    if (Array.isArray(middlewareOrHandler)) {
      routeMiddleware = middlewareOrHandler
      routeHandler = handler!
    } else {
      routeMiddleware = undefined
      routeHandler = middlewareOrHandler
    }

    // prettier-ignore
    let middleware =
      this.#middleware == null ? routeMiddleware :
      routeMiddleware == null ? this.#middleware?.slice(0) :
      this.#middleware.concat(routeMiddleware)

    this.#matcher.add((pattern as any).pattern ?? pattern, {
      method,
      middleware,
      handler: routeHandler,
    })
  }
}
