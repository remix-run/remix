import { FormDataParseError, parseFormData } from '@remix-run/form-data-parser'
import type { ParseFormDataOptions, FileUploadHandler } from '@remix-run/form-data-parser'
import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'
import type { Matcher } from '@remix-run/route-pattern'

import { runMiddleware } from './middleware.ts'
import type { Middleware } from './middleware.ts'
import { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import { RequestBodyMethods } from './request-methods.ts'
import type { RequestBodyMethod, RequestMethod } from './request-methods.ts'
import { isRequestHandlerWithMiddleware, isRouteHandlersWithMiddleware } from './route-handlers.ts'
import type { RouteHandlers, InferRouteHandler } from './route-handlers.ts'
import { Route } from './route-map.ts'
import type { RouteMap } from './route-map.ts'

export interface RouterOptions {
  /**
   * The default request handler that runs when no route matches.
   * Default is a 404 "Not Found" response.
   */
  defaultHandler?: RequestHandler
  /**
   * The matcher to use for matching routes.
   * Default is a `new RegExpMatcher()`.
   */
  matcher?: Matcher<MatchData>
  /**
   * The name of the form field to check for request method override. Default is `_method`.
   * Set `false` to disable method override support.
   */
  methodOverride?: string | boolean
  /**
   * Options for parsing form data.
   * Set `false` to disable form data parsing.
   */
  parseFormData?: (ParseFormDataOptions & { suppressErrors?: boolean }) | boolean
  /**
   * A function that handles file uploads. It receives a `FileUpload` object and may return any
   * value that is a valid `FormData` value.
   */
  uploadHandler?: FileUploadHandler
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

function noMatchHandler({ url }: RequestContext): Response {
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
  #parseFormData: (ParseFormDataOptions & { suppressErrors?: boolean }) | boolean
  #uploadHandler: FileUploadHandler | undefined
  #methodOverride: string | boolean

  constructor(options?: RouterOptions) {
    this.#defaultHandler = options?.defaultHandler ?? noMatchHandler
    this.#matcher = options?.matcher ?? new RegExpMatcher()
    this.#parseFormData = options?.parseFormData ?? true
    this.#uploadHandler = options?.uploadHandler
    this.#methodOverride = options?.methodOverride ?? true
  }

  /**
   * Fetch a response from the router.
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request = input instanceof Request ? input : new Request(input, init)

    let response = await this.dispatch(request)
    if (response == null) {
      response = await this.#defaultHandler(new RequestContext(request))
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
    request: Request | RequestContext,
    upstreamMiddleware?: Middleware[],
  ): Promise<Response | null> {
    let context = request instanceof Request ? await this.#parseRequest(request) : request

    for (let match of this.#matcher.matchAll(context.url)) {
      if ('router' in match.data) {
        // Matched a sub-router, try to dispatch to it
        let { middleware: mountMiddleware, prefix, router } = match.data

        // Save original URL and create new URL with stripped pathname
        let originalUrl = context.url
        let strippedUrl = new URL(match.url)
        strippedUrl.pathname = strippedUrl.pathname.slice(prefix.length)
        context.url = strippedUrl

        let response = await router.dispatch(
          context,
          // For mounts, pass upstream + mount middleware
          concatMiddleware(upstreamMiddleware, mountMiddleware),
        )

        // Always restore original URL
        context.url = originalUrl

        if (response != null) {
          return response
        }

        // No match in sub-router, continue to next match
        continue
      }

      let { method, middleware: routeMiddleware, handler } = match.data

      if (method !== context.method && method !== 'ANY') {
        continue
      }

      context.params = match.params
      context.url = match.url

      let middleware = concatMiddleware(upstreamMiddleware, routeMiddleware)
      return middleware != null
        ? await runMiddleware(middleware, context, handler)
        : await handler(context)
    }

    return null
  }

  async #parseRequest(request: Request): Promise<RequestContext> {
    let context = new RequestContext(request)

    if (this.#parseFormData === false) {
      return context
    }

    if (shouldParseFormData(request)) {
      let suppressParseErrors: boolean
      let parseOptions: ParseFormDataOptions
      if (this.#parseFormData === true) {
        suppressParseErrors = false
        parseOptions = {}
      } else {
        suppressParseErrors = this.#parseFormData.suppressErrors ?? false
        parseOptions = this.#parseFormData
      }

      try {
        context.formData = await parseFormData(request, parseOptions, this.#uploadHandler)
      } catch (error) {
        if (!suppressParseErrors || !(error instanceof FormDataParseError)) {
          throw error
        }

        // Suppress parse error, continue with empty formData
        context.formData = new FormData()
      }
    } else {
      // No form data to parse, continue with empty formData
      context.formData = new FormData()
    }

    if (this.#methodOverride) {
      let fieldName = this.#methodOverride === true ? '_method' : this.#methodOverride
      let methodOverride = context.formData.get(fieldName)
      if (typeof methodOverride === 'string' && methodOverride !== '') {
        context.method = methodOverride.toUpperCase() as RequestMethod
      }
    }

    return context
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
      middleware: this.#middleware,
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
    handler: InferRouteHandler<P>,
  ): void {
    let routeMiddleware: Middleware[] | undefined
    let requestHandler: RequestHandler
    if (isRequestHandlerWithMiddleware(handler)) {
      routeMiddleware = handler.use
      requestHandler = handler.handler
    } else {
      requestHandler = handler
    }

    this.#matcher.add(pattern instanceof Route ? pattern.pattern : pattern, {
      method,
      middleware: concatMiddleware(this.#middleware, routeMiddleware),
      handler: requestHandler,
    })
  }

  map<M extends RequestMethod | 'ANY', P extends string>(
    route: P | RoutePattern<P> | Route<M, P>,
    handler: InferRouteHandler<P>,
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
        let handler = (handlers as any)[key]

        if (route instanceof Route) {
          if (isRequestHandlerWithMiddleware(handler)) {
            this.route(route.method, route.pattern, {
              use: use.concat(handler.use),
              handler: handler.handler,
            })
          } else {
            this.route(route.method, route.pattern, { use, handler })
          }
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
        let handler = handlers[key]

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
    handler: InferRouteHandler<P>,
  ): void {
    this.route('GET', pattern, handler)
  }

  head<P extends string>(
    pattern: P | RoutePattern<P> | Route<'HEAD' | 'ANY', P>,
    handler: InferRouteHandler<P>,
  ): void {
    this.route('HEAD', pattern, handler)
  }

  post<P extends string>(
    pattern: P | RoutePattern<P> | Route<'POST' | 'ANY', P>,
    handler: InferRouteHandler<P>,
  ): void {
    this.route('POST', pattern, handler)
  }

  put<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PUT' | 'ANY', P>,
    handler: InferRouteHandler<P>,
  ): void {
    this.route('PUT', pattern, handler)
  }

  patch<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PATCH' | 'ANY', P>,
    handler: InferRouteHandler<P>,
  ): void {
    this.route('PATCH', pattern, handler)
  }

  delete<P extends string>(
    pattern: P | RoutePattern<P> | Route<'DELETE' | 'ANY', P>,
    handler: InferRouteHandler<P>,
  ): void {
    this.route('DELETE', pattern, handler)
  }

  options<P extends string>(
    pattern: P | RoutePattern<P> | Route<'OPTIONS' | 'ANY', P>,
    handler: InferRouteHandler<P>,
  ): void {
    this.route('OPTIONS', pattern, handler)
  }
}

function shouldParseFormData(request: Request): boolean {
  if (!RequestBodyMethods.includes(request.method as RequestBodyMethod)) {
    return false
  }

  let contentType = request.headers.get('Content-Type')

  return (
    contentType != null &&
    (contentType.startsWith('multipart/') ||
      contentType.startsWith('application/x-www-form-urlencoded'))
  )
}

function concatMiddleware(
  a: Middleware[] | undefined,
  b: Middleware[] | undefined,
): Middleware[] | undefined {
  return a == null ? b : b == null ? a : a.concat(b)
}
