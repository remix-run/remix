import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'
import type { Matcher } from '@remix-run/route-pattern'

import { runMiddleware } from './middleware.ts'
import type { Middleware } from './middleware.ts'
import { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'
import { isRequestHandlerWithMiddleware, isRouteHandlersWithMiddleware } from './route-handlers.ts'
import type { RouteHandlers, RouteHandler } from './route-handlers.ts'
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

type MatchData =
  | {
      method: RequestMethod | 'ANY'
      middleware: Middleware<any>[] | undefined
      handler: RequestHandler<any>
    }
  | {
      middleware: Middleware<any>[] | undefined
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

  route<M extends RequestMethod | 'ANY', P extends string>(
    method: M,
    pattern: P | RoutePattern<P> | Route<M | 'ANY', P>,
    routeHandler: RouteHandler<P>,
  ): void {
    let routeMiddleware: Middleware[] | undefined
    let handler: RequestHandler
    if (isRequestHandlerWithMiddleware(routeHandler)) {
      routeMiddleware = routeHandler.use
      handler = routeHandler.handler
    } else {
      handler = routeHandler
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

  map<M extends RequestMethod | 'ANY', P extends string>(
    route: P | RoutePattern<P> | Route<M, P>,
    handler: RouteHandler<P>,
  ): void
  map<T extends RouteMap>(routes: T, handlers: RouteHandlers<T>): void
  map(routeOrRoutes: any, handler: any): void {
    if (typeof routeOrRoutes === 'string' || routeOrRoutes instanceof RoutePattern) {
      // map(pattern, handler)
      this.route('ANY', routeOrRoutes, handler)
    } else if (routeOrRoutes instanceof Route) {
      // map(route, handler)
      this.route(routeOrRoutes.method, routeOrRoutes.pattern, handler)
    } else if (isRouteHandlersWithMiddleware(handler)) {
      // map(routes, { use, handlers })
      let use = handler.use
      let handlers = handler.handlers
      for (let key in routeOrRoutes) {
        let route = routeOrRoutes[key]
        let handler = handlers[key] as any

        if (route instanceof Route) {
          this.route(route.method, route.pattern, { use, handler })
        } else if (isRouteHandlersWithMiddleware(handler)) {
          this.map(route, { use: use.concat(handler.use), handlers: handler.handlers })
        } else {
          this.map(route, { use, handlers: handler })
        }
      }
    } else {
      // map(routes, handlers)
      let handlers = handler
      for (let key in routeOrRoutes) {
        let route = routeOrRoutes[key]
        let handler = handlers[key] as any

        if (route instanceof Route) {
          this.route(route.method, route.pattern, handler)
        } else {
          this.map(route, handler)
        }
      }
    }
  }

  // HTTP-method specific shorthand

  get<P extends string>(
    pattern: P | RoutePattern<P> | Route<'GET' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('GET', pattern, handler)
  }

  head<P extends string>(
    pattern: P | RoutePattern<P> | Route<'HEAD' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('HEAD', pattern, handler)
  }

  post<P extends string>(
    pattern: P | RoutePattern<P> | Route<'POST' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('POST', pattern, handler)
  }

  put<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PUT' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('PUT', pattern, handler)
  }

  patch<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PATCH' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('PATCH', pattern, handler)
  }

  delete<P extends string>(
    pattern: P | RoutePattern<P> | Route<'DELETE' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('DELETE', pattern, handler)
  }

  options<P extends string>(
    pattern: P | RoutePattern<P> | Route<'OPTIONS' | 'ANY', P>,
    handler: RouteHandler<P>,
  ): void {
    this.route('OPTIONS', pattern, handler)
  }
}
