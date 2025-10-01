import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'
import type { Matcher, MatchResult, Params } from '@remix-run/route-pattern'

import { RequestContext, runMiddleware } from './request-handler.ts'
import type { Middleware, RequestHandler, RequestMethod } from './request-handler.ts'

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
  matcher?: Matcher<RouteData>
}

interface RouteData {
  method: RequestMethod | 'ALL'
  middleware: Middleware[] | undefined
  handler: RequestHandler
}

export function createRouter(options?: RouterOptions): Router {
  return new Router(options)
}

export class Router {
  #defaultHandler: RequestHandler
  #matcher: Matcher<RouteData>
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

    if (response != null) {
      return response
    }

    let defaultContext = new RequestContext({}, request, new URL(request.url))

    return this.#defaultHandler(defaultContext)
  }

  /**
   * Low-level method that runs a request through the router and returns a response or null if no
   * match is found.
   */
  async dispatch(request: Request | RequestContext): Promise<Response | null> {
    let match = this.match(request instanceof Request ? request : request.request)

    if (match) {
      let { handler, middleware } = match.data
      let context =
        request instanceof Request
          ? new RequestContext(match.params, request, match.url)
          : new RequestContext(match.params, request.request, request.url, request.storage)

      if (middleware != null) {
        return await runMiddleware(middleware, context, handler)
      }

      return handler(context)
    }

    return null
  }

  match(input: string | URL | Request): MatchResult<RouteData> | null {
    return input instanceof Request ? this.#matchRequest(input) : this.#matcher.match(input)
  }

  #matchRequest(request: Request): MatchResult<RouteData> | null {
    for (let match of this.#matcher.matchAll(request.url)) {
      if (match.data.method === request.method || match.data.method === 'ALL') {
        return match
      }
    }

    return null
  }

  // Middleware/sub-router registration

  use(middleware: Middleware | Middleware[]): void
  use(router: Router): void
  use(arg: any): void {
    if (typeof arg === 'function' || Array.isArray(arg)) {
      this.#middleware = this.#middleware?.concat(arg) ?? [arg]
    } else {
      this.#middleware = this.#middleware?.concat(tryRouter(arg)) ?? [tryRouter(arg)]
    }
  }

  // Route registration

  get<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'GET',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  post<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'POST',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  put<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'PUT',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  patch<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'PATCH',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  delete<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'DELETE',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  options<P extends string>(
    pattern: P | RoutePattern<P>,
    handler: RequestHandler<Params<P>>,
  ): void {
    this.#matcher.add(pattern, {
      method: 'OPTIONS',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  head<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'HEAD',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }

  all<P extends string>(pattern: P | RoutePattern<P>, handler: RequestHandler<Params<P>>): void {
    this.#matcher.add(pattern, {
      method: 'ALL',
      middleware: this.#middleware?.slice(0) ?? undefined,
      handler,
    })
  }
}

function defaultHandler(): Response {
  return new Response('Not Found', { status: 404 })
}

/**
 * A middleware that delegates to another router.
 */
function tryRouter(router: Router): Middleware {
  return async (context) => {
    let response = await router.dispatch(context)

    if (response != null) {
      return response
    }
  }
}
