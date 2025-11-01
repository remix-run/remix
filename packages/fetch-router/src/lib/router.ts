import {
  type ParseFormDataOptions,
  type FileUploadHandler,
  FormDataParseError,
  parseFormData,
} from '@remix-run/form-data-parser'
import { type Matcher, RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type Middleware, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import {
  type RequestBodyMethod,
  type RequestMethod,
  RequestBodyMethods,
} from './request-methods.ts'
import {
  type RouteHandlers,
  type RouteHandler,
  isRequestHandlerWithMiddleware,
  isRouteHandlersWithMiddleware,
} from './route-handlers.ts'
import { type RouteMap, Route } from './route-map.ts'

type MatchData = {
  handler: RequestHandler<any>
  method: RequestMethod | 'ANY'
  middleware: Middleware<any>[] | undefined
}

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
   * Middleware to run for all routes.
   */
  middleware?: Middleware[]
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
    this.#middleware = options?.middleware
    this.#parseFormData = options?.parseFormData ?? true
    this.#uploadHandler = options?.uploadHandler
    this.#methodOverride = options?.methodOverride ?? true
  }

  /**
   * Fetch a response from the router.
   * @param input The request input to fetch
   * @param init The request init options
   * @returns The response from the route that matched the request
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    let request = new Request(input, init)

    if (request.signal.aborted) {
      throw request.signal.reason
    }

    let context = await this.#createContext(request)
    let response = this.#middleware
      ? await runMiddleware(this.#middleware, context, this.#dispatch.bind(this))
      : await this.#dispatch(context)

    return response
  }

  async #createContext(request: Request): Promise<RequestContext> {
    let context = new RequestContext(request)

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

  async #dispatch(context: RequestContext): Promise<Response> {
    for (let match of this.#matcher.matchAll(context.url)) {
      let { handler, method, middleware } = match.data

      if (method !== context.method && method !== 'ANY') {
        // Request method does not match, continue to next match
        continue
      }

      context.params = match.params
      context.url = match.url

      if (middleware) {
        return runMiddleware(middleware, context, handler)
      }

      return raceRequestAbort(Promise.resolve(handler(context)), context.request)
    }

    return raceRequestAbort(Promise.resolve(this.#defaultHandler(context)), context.request)
  }

  /**
   * The number of routes in the router.
   */
  get size(): number {
    return this.#matcher.size
  }

  // Route mapping

  /**
   * Add a route to the router.
   * @param method The request method to match
   * @param pattern The pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>,
    handler: RouteHandler<method, pattern>,
  ): void {
    let middleware: Middleware<any, any>[] | undefined
    let requestHandler: RequestHandler<any, any>
    if (isRequestHandlerWithMiddleware(handler)) {
      middleware = handler.middleware
      requestHandler = handler.handler
    } else {
      requestHandler = handler
    }

    this.#matcher.add(pattern instanceof Route ? pattern.pattern : pattern, {
      handler: requestHandler,
      method,
      middleware,
    })
  }

  /**
   * Map a route map (or route/pattern) to request handlers.
   * @param route The routes or pattern to match
   * @param handler The request handler(s) to invoke when the routes match
   */
  map<method extends RequestMethod | 'ANY', route extends string>(
    route: route | RoutePattern<route> | Route<method, route>,
    handler: RouteHandler<method, route>,
  ): void
  map<routeMap extends RouteMap>(routes: routeMap, handlers: RouteHandlers<routeMap>): void
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
      // map(routes, { middleware, handlers })
      let middleware = handler.middleware
      let handlers = handler.handlers
      for (let key in routeOrRoutes) {
        let route = routeOrRoutes[key]
        let handler = (handlers as any)[key]

        if (route instanceof Route) {
          if (isRequestHandlerWithMiddleware(handler)) {
            this.route(route.method, route.pattern, {
              middleware: middleware.concat(handler.middleware),
              handler: handler.handler,
            })
          } else {
            this.route(route.method, route.pattern, { middleware, handler })
          }
        } else if (isRouteHandlersWithMiddleware(handler)) {
          this.map(route, {
            middleware: middleware.concat(handler.middleware),
            handlers: handler.handlers,
          })
        } else {
          this.map(route, { middleware, handlers: handler })
        }
      }
    }
  }

  // HTTP-method specific shorthand

  /**
   * Map a GET route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  get<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>,
    handler: RouteHandler<'GET', pattern>,
  ): void {
    this.route('GET', route, handler)
  }

  /**
   * Map a HEAD route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  head<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>,
    handler: RouteHandler<'HEAD', pattern>,
  ): void {
    this.route('HEAD', route, handler)
  }

  /**
   * Map a POST route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  post<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>,
    handler: RouteHandler<'POST', pattern>,
  ): void {
    this.route('POST', route, handler)
  }

  /**
   * Map a PUT route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  put<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>,
    handler: RouteHandler<'PUT', pattern>,
  ): void {
    this.route('PUT', route, handler)
  }

  /**
   * Map a PATCH route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  patch<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>,
    handler: RouteHandler<'PATCH', pattern>,
  ): void {
    this.route('PATCH', route, handler)
  }

  /**
   * Map a DELETE route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  delete<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>,
    handler: RouteHandler<'DELETE', pattern>,
  ): void {
    this.route('DELETE', route, handler)
  }

  /**
   * Map a OPTIONS route/pattern to a request handler.
   * @param route The route/pattern to match
   * @param handler The request handler to invoke when the route matches
   */
  options<pattern extends string>(
    route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>,
    handler: RouteHandler<'OPTIONS', pattern>,
  ): void {
    this.route('OPTIONS', route, handler)
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
