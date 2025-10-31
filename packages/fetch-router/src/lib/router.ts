import { FormDataParseError, parseFormData } from '@remix-run/form-data-parser'
import type { ParseFormDataOptions, FileUploadHandler } from '@remix-run/form-data-parser'
import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'
import type { Matcher } from '@remix-run/route-pattern'

import { runMiddleware } from './middleware.ts'
import type { Middleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import { RequestBodyMethods } from './request-methods.ts'
import type { RequestBodyMethod, RequestMethod } from './request-methods.ts'
import { isRequestHandlerWithMiddleware, isRouteHandlersWithMiddleware } from './route-handlers.ts'
import type { RouteHandlers, RouteHandler } from './route-handlers.ts'
import { Route } from './route-map.ts'
import type { RouteMap } from './route-map.ts'
import type { SessionStorage } from '@remix-run/session'
import { createCookieSessionStorage } from '@remix-run/session'
import { session } from './middleware/session.ts'

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
   * Session storage instance to create user sessions.
   */
  sessionStorage?: SessionStorage
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
  #sessionStorage: SessionStorage
  #uploadHandler: FileUploadHandler | undefined
  #methodOverride: string | boolean

  constructor(options?: RouterOptions) {
    this.#defaultHandler = options?.defaultHandler ?? noMatchHandler
    this.#matcher = options?.matcher ?? new RegExpMatcher()
    this.#parseFormData = options?.parseFormData ?? true
    this.#sessionStorage = options?.sessionStorage ?? createCookieSessionStorage()
    this.#uploadHandler = options?.uploadHandler
    this.#methodOverride = options?.methodOverride ?? true
  }

  /**
   * Fetch a response from the router.
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request = new Request(input, init)

    if (request.signal.aborted) {
      throw request.signal.reason
    }

    let context = await this.#createContext(request)
    let response = await this.dispatch(context)
    if (response == null) {
      response = await this.#runHandler(this.#defaultHandler, context, this.#middleware)
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
    let context = request instanceof Request ? await this.#createContext(request) : request

    // Prepend session middleware only for the root router
    upstreamMiddleware =
      upstreamMiddleware == null
        ? [session({ sessionStorage: this.#sessionStorage })]
        : upstreamMiddleware

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
          concatMiddleware(upstreamMiddleware, mountMiddleware),
        )

        // Always restore original URL
        context.url = originalUrl

        if (response == null) {
          // No response from sub-router, continue to next match
          continue
        }

        return response
      }

      let { method, middleware: routeMiddleware, handler } = match.data

      if (method !== context.method && method !== 'ANY') {
        // Request method does not match, continue to next match
        continue
      }

      context.params = match.params
      context.url = match.url

      return this.#runHandler(
        handler,
        context,
        concatMiddleware(upstreamMiddleware, routeMiddleware),
      )
    }

    return null
  }

  async #createContext(request: Request): Promise<RequestContext> {
    // We have to create the session here because it's an async operation to
    // parse the cookie internally using `cookie.parse()`.
    // - We can't use a `get session()` getter to lazily create the session because
    //   `getSession` is async
    // - We can't create the session in the `RequestContext` constructor because
    //   constructors can't be async
    // - If we assign the session in the middleware, then `context.session` has
    //   to have a type of `Session | undefined` which is inconvenient for users
    let session = await this.#sessionStorage.getSession(request.headers.get('Cookie'))
    let context = new RequestContext(request, session)

    if (!RequestBodyMethods.includes(request.method as RequestBodyMethod)) {
      return context
    }

    if (this.#parseFormData === false || !canParseFormData(request)) {
      // Either form data parsing is disabled or the request body cannot be
      // parsed as form data, so continue with an empty formData object
      context.formData = new FormData()
      return context
    }

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
      return context
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

  async #runHandler(
    handler: RequestHandler,
    context: RequestContext,
    middleware?: Middleware[],
  ): Promise<Response> {
    return middleware == null
      ? await raceRequestAbort(Promise.resolve(handler(context)), context.request)
      : await runMiddleware(middleware, context, handler)
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
    handler: RouteHandler<M, P>,
  ): void {
    let routeMiddleware: Middleware<any, any>[] | undefined
    let requestHandler: RequestHandler<any, any>
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
    handler: RouteHandler<M, P>,
  ): void
  map<T extends RouteMap>(routes: T, handlers: RouteHandlers<T>): void
  map(routeOrRoutes: any, handler: any): void {
    if (typeof routeOrRoutes === 'string' || routeOrRoutes instanceof RoutePattern) {
      // map(pattern, handler)
      this.route('ANY', routeOrRoutes, handler)
    } else if (routeOrRoutes instanceof Route) {
      // map(route, handler)
      this.route(routeOrRoutes.method, routeOrRoutes.pattern, handler)
    } else if (!isRouteHandlersWithMiddleware(handler)) {
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
    } else {
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
    }
  }

  // HTTP-method specific shorthand

  get<P extends string>(
    pattern: P | RoutePattern<P> | Route<'GET' | 'ANY', P>,
    handler: RouteHandler<'GET', P>,
  ): void {
    this.route('GET', pattern, handler)
  }

  head<P extends string>(
    pattern: P | RoutePattern<P> | Route<'HEAD' | 'ANY', P>,
    handler: RouteHandler<'HEAD', P>,
  ): void {
    this.route('HEAD', pattern, handler)
  }

  post<P extends string>(
    pattern: P | RoutePattern<P> | Route<'POST' | 'ANY', P>,
    handler: RouteHandler<'POST', P>,
  ): void {
    this.route('POST', pattern, handler)
  }

  put<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PUT' | 'ANY', P>,
    handler: RouteHandler<'PUT', P>,
  ): void {
    this.route('PUT', pattern, handler)
  }

  patch<P extends string>(
    pattern: P | RoutePattern<P> | Route<'PATCH' | 'ANY', P>,
    handler: RouteHandler<'PATCH', P>,
  ): void {
    this.route('PATCH', pattern, handler)
  }

  delete<P extends string>(
    pattern: P | RoutePattern<P> | Route<'DELETE' | 'ANY', P>,
    handler: RouteHandler<'DELETE', P>,
  ): void {
    this.route('DELETE', pattern, handler)
  }

  options<P extends string>(
    pattern: P | RoutePattern<P> | Route<'OPTIONS' | 'ANY', P>,
    handler: RouteHandler<'OPTIONS', P>,
  ): void {
    this.route('OPTIONS', pattern, handler)
  }
}

function canParseFormData(request: Request): boolean {
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
