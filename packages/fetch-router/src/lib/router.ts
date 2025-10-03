import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'
import type { Matcher, Params } from '@remix-run/route-pattern'

import { RequestContext, runMiddleware } from './request-handler.ts'
import type { Middleware, RequestHandler, RequestMethod, AnyMethod } from './request-handler.ts'
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
      method: RequestMethod | AnyMethod
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
      middleware: this.#middleware?.slice(0),
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

  // Route mapping

  map<M extends RequestMethod | AnyMethod, P extends string>(
    route: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  map<M extends RequestMethod | AnyMethod, P extends string>(
    route: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  map<T extends RouteMap>(routes: T, handlers: HandlerMap<T>): void
  map<T extends RouteMap>(routes: T, middleware: Middleware[], handlers: HandlerMap<T>): void
  map(routeOrRoutes: any, middlewareOrHandlers: any, maybeHandlers?: any): void {
    if (typeof routeOrRoutes === 'string' || routeOrRoutes instanceof RoutePattern) {
      this.route('ANY', routeOrRoutes, middlewareOrHandlers, maybeHandlers)
    } else if (routeOrRoutes instanceof Route) {
      this.route(routeOrRoutes.method, routeOrRoutes.pattern, middlewareOrHandlers, maybeHandlers)
    } else {
      let handlers = maybeHandlers == null ? middlewareOrHandlers : maybeHandlers
      for (let key in routeOrRoutes) {
        let route = routeOrRoutes[key]
        let handler = handlers[key]
        if (route instanceof Route) {
          this.route(route.method, route.pattern, middlewareOrHandlers, handler)
        } else {
          this.map(route, middlewareOrHandlers, handler)
        }
      }
    }
  }

  route<M extends RequestMethod | AnyMethod, P extends string>(
    method: M,
    pattern: P | RoutePattern<P> | Route<M, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  route<M extends RequestMethod | AnyMethod, P extends string>(
    method: M,
    pattern: P | RoutePattern<P> | Route<M, P>,
    middleware: Middleware<Params<P>>[] | undefined,
    handler: RequestHandler<Params<P>>,
  ): void
  route<M extends RequestMethod | AnyMethod, P extends string>(
    method: M,
    pattern: P | RoutePattern<P> | Route<M, P>,
    middlewareOrHandler: any,
    maybeHandler?: RequestHandler<Params<P>>,
  ): void {
    let routeMiddleware: Middleware[] | undefined
    let handler: RequestHandler<Params<P>>
    if (maybeHandler != null) {
      routeMiddleware =
        Array.isArray(middlewareOrHandler) && middlewareOrHandler.length > 0
          ? middlewareOrHandler
          : undefined
      handler = maybeHandler
    } else {
      routeMiddleware = undefined
      handler = middlewareOrHandler
    }

    // prettier-ignore
    let middleware =
      this.#middleware == null ? routeMiddleware :
      routeMiddleware == null ? this.#middleware?.slice(0) :
      this.#middleware.concat(routeMiddleware)

    this.#matcher.add(pattern instanceof Route ? pattern.pattern : pattern, {
      method,
      middleware,
      handler,
    })
  }

  // HTTP-method specific route mapping

  get<P extends string>(
    pattern: P | RoutePattern<P> | Route<'GET' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  get<P extends string>(
    pattern: P | RoutePattern<P> | Route<'GET' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  get<P extends string>(
    pattern: P | RoutePattern<P> | Route<'GET' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('GET', pattern, middlewareOrHandler, handler)
  }

  head<P extends string>(
    pattern: P | RoutePattern<P> | Route<'HEAD' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  head<P extends string>(
    pattern: P | RoutePattern<P> | Route<'HEAD' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  head<P extends string>(
    pattern: P | RoutePattern<P> | Route<'HEAD' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('HEAD', pattern, middlewareOrHandler, handler)
  }

  post<P extends string>(
    pattern: P | RoutePattern<P> | Route<'POST' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  post<P extends string>(
    pattern: P | RoutePattern<P> | Route<'POST' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  post<P extends string>(
    pattern: P | RoutePattern<P> | Route<'POST' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('POST', pattern, middlewareOrHandler, handler)
  }

  put<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PUT' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  put<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PUT' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  put<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PUT' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('PUT', pattern, middlewareOrHandler, handler)
  }

  patch<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PATCH' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  patch<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PATCH' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  patch<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PATCH' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('PATCH', pattern, middlewareOrHandler, handler)
  }

  delete<P extends string>(
    pattern: P | RoutePattern<P> | Route<'DELETE' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  delete<P extends string>(
    pattern: P | RoutePattern<P> | Route<'DELETE' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  delete<P extends string>(
    pattern: P | RoutePattern<P> | Route<'DELETE' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('DELETE', pattern, middlewareOrHandler, handler)
  }

  options<P extends string>(
    pattern: P | RoutePattern<P> | Route<'OPTIONS' | AnyMethod, P>,
    handler: RequestHandler<Params<P>>,
  ): void
  options<P extends string>(
    pattern: P | RoutePattern<P> | Route<'OPTIONS' | AnyMethod, P>,
    middleware: Middleware<Params<P>>[],
    handler: RequestHandler<Params<P>>,
  ): void
  options<P extends string>(
    pattern: P | RoutePattern<P> | Route<'OPTIONS' | AnyMethod, P>,
    middlewareOrHandler: any,
    handler?: any,
  ): void {
    this.route('OPTIONS', pattern, middlewareOrHandler, handler)
  }
}
