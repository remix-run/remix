import { RoutePattern } from '@remix-run/route-pattern'
import type { Join, RoutePatternOptions } from '@remix-run/route-pattern'

import { Route } from './route.ts'
import type { RouteHandler, RouteMethod } from './route.ts'

type AnyRoute = Route<RouteMethod, string>
type ChildRoutes = ReadonlyArray<AnyRoute | ChildRoutes>

// prettier-ignore
type Flatten<T extends ReadonlyArray<any>> =
  T extends readonly [infer Head, ...infer Tail] ?
    Head extends ReadonlyArray<any> ? [...Flatten<Head>, ...Flatten<Tail>] :
    [Head, ...Flatten<Tail>] :
  []

export class RouteBuilder<T extends string = '/'> {
  readonly pattern: RoutePattern<T>
  #patternOptions: RoutePatternOptions

  // shorthand for delete
  readonly del: RouteBuilder<T>['delete']

  constructor(
    pattern: T | RoutePattern<T> = '/' as T | RoutePattern<T>,
    options?: RoutePatternOptions,
  ) {
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern, options) : pattern
    this.#patternOptions = options ?? {}

    // Auto-bind all methods so a builder may be destructured
    this.get = this.get.bind(this)
    this.head = this.head.bind(this)
    this.post = this.post.bind(this)
    this.put = this.put.bind(this)
    this.patch = this.patch.bind(this)
    this.delete = this.delete.bind(this)
    this.del = this.delete.bind(this) // shorthand for delete
    this.options = this.options.bind(this)
    this.any = this.any.bind(this)
    this.mount = this.mount.bind(this)
  }

  #joinPattern<P extends string>(input: P | RoutePattern<P>): RoutePattern<Join<T, P>> {
    return this.pattern.join(input, this.#patternOptions)
  }

  get<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'GET', Join<T, P>> {
    return new Route('GET', this.#joinPattern(input), handler)
  }

  head<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'HEAD', Join<T, P>> {
    return new Route('HEAD', this.#joinPattern(input), handler)
  }

  post<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'POST', Join<T, P>> {
    return new Route('POST', this.#joinPattern(input), handler)
  }

  put<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'PUT', Join<T, P>> {
    return new Route('PUT', this.#joinPattern(input), handler)
  }

  patch<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'PATCH', Join<T, P>> {
    return new Route('PATCH', this.#joinPattern(input), handler)
  }

  delete<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'DELETE', Join<T, P>> {
    return new Route('DELETE', this.#joinPattern(input), handler)
  }

  options<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): Route<'OPTIONS', Join<T, P>> {
    return new Route('OPTIONS', this.#joinPattern(input), handler)
  }

  any<P extends string>(
    input: P | RoutePattern<P>,
    handler: RouteHandler<P>,
  ): [
    Route<'GET', Join<T, P>>,
    Route<'HEAD', Join<T, P>>,
    Route<'POST', Join<T, P>>,
    Route<'PUT', Join<T, P>>,
    Route<'PATCH', Join<T, P>>,
    Route<'DELETE', Join<T, P>>,
    Route<'OPTIONS', Join<T, P>>,
  ] {
    return [
      this.get(input, handler),
      this.head(input, handler),
      this.post(input, handler),
      this.put(input, handler),
      this.patch(input, handler),
      this.delete(input, handler),
      this.options(input, handler),
    ]
  }

  mount<P extends string, const C extends ChildRoutes>(
    input: P | RoutePattern<P>,
    callback: (builder: RouteBuilder<Join<T, P>>) => C,
  ): Flatten<C> {
    return callback(new RouteBuilder(this.#joinPattern(input))).flat(1) as Flatten<C>
  }
}

export function createRoutes<P extends string, const C extends ChildRoutes>(
  pattern: P | RoutePattern<P>,
  options: RoutePatternOptions,
  callback: (builder: RouteBuilder<P>) => C,
): Flatten<C>
export function createRoutes<P extends string, const C extends ChildRoutes>(
  pattern: P | RoutePattern<P>,
  callback: (builder: RouteBuilder<P>) => C,
): Flatten<C>
export function createRoutes<const C extends ChildRoutes>(
  callback: (builder: RouteBuilder) => C,
): Flatten<C>
export function createRoutes(a: any, b?: any, c?: any): any {
  if (typeof a === 'function') {
    return a(new RouteBuilder()).flat(1)
  }

  if (typeof a === 'string' || a instanceof RoutePattern) {
    if (typeof b === 'function') {
      // createRoutes(pattern, callback)
      return b(new RouteBuilder(a)).flat(1)
    } else if (typeof c === 'function') {
      // createRoutes(pattern, options, callback)
      return c(new RouteBuilder(a, b)).flat(1)
    } else {
      throw new Error('Invalid arguments')
    }
  }

  throw new Error('Invalid arguments')
}

let routes = createRoutes('foo', ({ get, post, mount }) => [
  get('home', () => new Response('Home')),
  post('/login', () => new Response('Login')),
  mount('admin', ({ get, post }) => [
    get('dashboard', () => new Response('Admin Dashboard')),
    post('login', () => new Response('Admin Login')),
  ]),
])
