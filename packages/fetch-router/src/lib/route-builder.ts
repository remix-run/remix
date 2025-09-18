import { RoutePattern } from '@remix-run/route-pattern'
import type { Join, RoutePatternOptions } from '@remix-run/route-pattern'

import type { Middleware } from './middleware.ts'
import { createRoute } from './route.ts'
import type { Route } from './route.ts'
import type { RouteHandler } from './route-handler.ts'

export type RouteConfig = ReadonlyArray<Route | Middleware | RouteConfig>

export class RouteBuilder<P extends string = '/'> {
  readonly pattern: RoutePattern<P>
  #patternOptions: RoutePatternOptions | undefined

  readonly del: RouteBuilder<P>['delete']

  constructor(
    pattern: P | RoutePattern<P> = '/' as P | RoutePattern<P>,
    options?: RoutePatternOptions,
  ) {
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern, options) : pattern
    this.#patternOptions = options

    // Auto-bind all methods so a builder may be destructured, e.g. in a mount() callback
    this.mount = this.mount.bind(this)
    this.route = this.route.bind(this)
    this.get = this.get.bind(this)
    this.head = this.head.bind(this)
    this.post = this.post.bind(this)
    this.put = this.put.bind(this)
    this.patch = this.patch.bind(this)
    this.delete = this.delete.bind(this)
    this.del = this.delete.bind(this) // shorthand for delete
    this.options = this.options.bind(this)
    this.use = this.use.bind(this)
  }

  #join<T extends string>(input: T | RoutePattern<T>): RoutePattern<Join<P, T>> {
    return this.pattern.join(input, this.#patternOptions)
  }

  mount<T extends string, const C extends RouteConfig>(
    input: T | RoutePattern<T>,
    callback: (builder: RouteBuilder<Join<P, T>>) => C,
  ): C {
    return callback(new RouteBuilder(this.#join(input)))
  }

  route<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): [
    Route<'GET', Join<P, T>>,
    Route<'HEAD', Join<P, T>>,
    Route<'POST', Join<P, T>>,
    Route<'PUT', Join<P, T>>,
    Route<'PATCH', Join<P, T>>,
    Route<'DELETE', Join<P, T>>,
    Route<'OPTIONS', Join<P, T>>,
  ] {
    return [
      createRoute('GET', this.#join(input), handler),
      createRoute('HEAD', this.#join(input), handler),
      createRoute('POST', this.#join(input), handler),
      createRoute('PUT', this.#join(input), handler),
      createRoute('PATCH', this.#join(input), handler),
      createRoute('DELETE', this.#join(input), handler),
      createRoute('OPTIONS', this.#join(input), handler),
    ]
  }

  // Individual HTTP method helpers

  get<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'GET', Join<P, T>> {
    return createRoute('GET', this.#join(input), handler)
  }

  head<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'HEAD', Join<P, T>> {
    return createRoute('HEAD', this.#join(input), handler)
  }

  post<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'POST', Join<P, T>> {
    return createRoute('POST', this.#join(input), handler)
  }

  put<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'PUT', Join<P, T>> {
    return createRoute('PUT', this.#join(input), handler)
  }

  patch<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'PATCH', Join<P, T>> {
    return createRoute('PATCH', this.#join(input), handler)
  }

  delete<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'DELETE', Join<P, T>> {
    return createRoute('DELETE', this.#join(input), handler)
  }

  options<T extends string>(
    input: T | RoutePattern<T>,
    handler: RouteHandler<T>,
  ): Route<'OPTIONS', Join<P, T>> {
    return createRoute('OPTIONS', this.#join(input), handler)
  }

  // Middleware

  use(...middleware: Middleware<P>[]): Middleware<P>[] {
    return middleware
  }
}

export function buildRoutes<P extends string, const C extends RouteConfig>(
  pattern: P | RoutePattern<P>,
  options: RoutePatternOptions,
  callback: (builder: RouteBuilder<P>) => C,
): C
export function buildRoutes<P extends string, const C extends RouteConfig>(
  pattern: P | RoutePattern<P>,
  callback: (builder: RouteBuilder<P>) => C,
): C
export function buildRoutes<const C extends RouteConfig>(callback: (builder: RouteBuilder) => C): C
export function buildRoutes(a: any, b?: any, c?: any): any {
  if (typeof a === 'function') {
    // buildRoutes(callback)
    return a(new RouteBuilder())
  }

  if (typeof a === 'string' || a instanceof RoutePattern) {
    if (typeof b === 'function') {
      // buildRoutes(pattern, callback)
      return b(new RouteBuilder(a))
    } else if (typeof c === 'function') {
      // buildRoutes(pattern, options, callback)
      return c(new RouteBuilder(a, b))
    } else {
      throw new Error('Invalid arguments')
    }
  }

  throw new Error('Invalid arguments')
}

// prettier-ignore
type PatternsFromRoutes<C extends RouteConfig> =
  C extends readonly [infer Head, ...infer Tail extends RouteConfig] ?
    Head extends Route ? Head['pattern'] | PatternsFromRoutes<Tail> :
    Head extends RouteConfig ? PatternsFromRoutes<Head> | PatternsFromRoutes<Tail> :
    PatternsFromRoutes<Tail> :
  never

function adminRoutes({ get, mount }: RouteBuilder<'/admin'>) {
  return [
    get('/', () => new Response('admin')),
    mount('dashboard', ({ get }) => [
      get('/', () => new Response('admin dashboard')),
      get('users', () => new Response('admin users')),
    ]),
  ] as const
}

let routes = buildRoutes(({ get, mount }) => [
  get('/', () => new Response('home')),
  get('/about', () => new Response('about')),
  mount('admin', adminRoutes),
])

type P = PatternsFromRoutes<typeof routes>
