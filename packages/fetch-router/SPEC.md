## fetch-router Technical Specification

This document specifies the public API, core types, and routing semantics for the `@remix-run/fetch-router` package. The design builds on primitives from `@remix-run/route-pattern` and is sufficient to implement a router capable of running all examples shown in the README.

### Goals and Scope

- Provide a small, Fetch API–native router for composing route handlers and middleware.
- Use `@remix-run/route-pattern` for parsing and matching paths and for generating type-safe hrefs.
- Support mounting nested route trees under a path prefix with predictable slash normalization.
- Support middleware that may be sync or async and that may short-circuit or allow downstream to proceed.

Non-goals: Advanced error handling policy, content negotiation, method override, or framework-specific abstractions.

---

## Core Types

All type names and signatures are TypeScript.

### HTTP Methods

```ts
export type RouteMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
```

### Route Patterns and Params

`@remix-run/route-pattern` provides:

- `class RoutePattern<T extends string>`: represents a path pattern like `'/users/:id'`.
- `type Params<T extends string>`: parameter map derived from `T`.
- `createHrefBuilder<TPatterns extends string>(): (pattern: TPatterns, params?: Record<string, string | number>, search?: string | URLSearchParams) => string`

`fetch-router` consumes these types and passes pattern strings or `RoutePattern<T>` instances through to matching.

### Routing Context

```ts
export interface RoutingContext<TPattern extends string = string> {
  request: Request
  params: import('@remix-run/route-pattern').Params<TPattern>
  url: URL

  // Custom context storage
  set<TKey extends ContextKey<any>>(key: TKey, value: ContextKeyValue<TKey>): void
  get<TKey extends ContextKey<any>>(key: TKey): ContextKeyValue<TKey>
}

export class UnsetContextError extends Error {}

// Keys are identity-based. Strings are allowed but Symbols/unique objects are recommended to avoid collisions.
export type ContextKey<T> = object & Partial<{ defaultValue: T }>

export type ContextKeyValue<TKey> = TKey extends ContextKey<infer T> ? T : never
```

Semantics:

- `context.get(key)` returns the last value set for `key` in this request. If no value was set and the `key` object has a `defaultValue` property, returns that; otherwise throws `UnsetContextError`.
- `context.set` only affects the current request; it does not mutate any global state.

### Handlers and Middleware

```ts
export type RouteHandler<TPattern extends string = string> = (
  context: RoutingContext<TPattern>,
) => Response | Promise<Response>

export type NextFunction = () => Promise<Response>

export type Middleware = (
  context: RoutingContext<string>,
  next: NextFunction,
) => void | Response | Promise<void | Response>
```

Semantics:

- Handlers may be sync or async; they must ultimately produce a `Response`.
- Middleware may be sync or async and may:
  - return a `Response` to short-circuit downstream processing, or
  - return `void`/`undefined`, in which case the downstream response is used. If the middleware did not call `next()` itself, the router will call it automatically.

### Routes

```ts
export interface RouteObject<
  TPattern extends string = string,
  TMethod extends RouteMethod = RouteMethod,
> {
  method?: TMethod
  pattern: TPattern | RoutePattern<TPattern>
  handler: RouteHandler<TPattern>
}

export type Routes = readonly RouteEntry[]

// A RouteEntry is one of: a Route, a Middleware group (via use()), or a Mount
export type RouteEntry =
  | {
      type: 'route'
      method: RouteMethod | 'ANY'
      pattern: RoutePattern<string>
      handler: RouteHandler<any>
    }
  | { type: 'middleware'; handlers: readonly Middleware[] }
  | { type: 'mount'; prefix: RoutePattern<string>; children: Routes }
```

### Router

```ts
export interface RouterOptions {
  routes: Routes
}

export interface Router {
  fetch(request: Request): Promise<Response>
}
```

---

## Public API

All functions are exported from `@remix-run/fetch-router`.

### createRouter

```ts
export function createRouter(options: RouterOptions): Router
```

- Builds a router from the provided `routes` array.
- The router is a simple object with a single `fetch()` method that processes a `Request` and resolves to a `Response`.

### route (shorthand and longhand)

Shorthand signatures (default method: ANY):

```ts
export function route<TPattern extends string>(
  pattern: TPattern | RoutePattern<TPattern>,
  handler: RouteHandler<TPattern>,
): RouteEntry

route.get<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
route.post<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
route.put<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
route.patch<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
route.delete<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
route.head<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
route.options<TPattern extends string>(pattern: TPattern | RoutePattern<TPattern>, handler: RouteHandler<TPattern>): RouteEntry
```

Longhand signature:

```ts
export function route<TPattern extends string, TMethod extends RouteMethod>(
  options: RouteObject<TPattern, TMethod>,
): RouteEntry
```

Notes:

- The shorthand `route(pattern, handler)` matches ANY HTTP method.
- The `.get/.post/...` helpers narrow to a specific method.
- The longhand form sets `method` explicitly; if omitted, the default is ANY.

Special method handling:

- `HEAD` requests match `HEAD` routes. If no `HEAD` route exists but a `GET` route matches the same pattern, the router SHOULD use the `GET` handler to produce a response and then strip the body while preserving status and headers.
- `OPTIONS` requests match `OPTIONS` routes. If none exists and a route pattern matches, the router SHOULD synthesize `204 No Content` with an `Allow` header listing the supported methods for that pattern. If no route pattern matches at all, return `404`.

### use (middleware)

```ts
export function use(...fns: readonly Middleware[]): RouteEntry
```

Notes:

- Accepts one or more middleware functions as varargs and returns a single `RouteEntry` of kind `middleware`.
- Middleware applies only to routes that are defined after it appears in the `routes` array.
- Middleware entries can appear anywhere in the `routes` array; when nested under a `mount`, they only apply to routes within that mount.

### mount

```ts
export function mount<TPrefix extends string>(
  prefix: TPrefix | RoutePattern<TPrefix>,
  routes: Routes,
): RouteEntry
```

Notes:

- Nesting `mount()` composes prefixes. Path joining is normalized to use exactly one slash at boundaries; a trailing slash on the parent is ignored. For example, `mount('/admin/', [ mount('dashboard', [...]) ])` yields the effective prefix `'/admin/dashboard'`.

### Types for PatternsFromRoutes

```ts
// From @remix-run/fetch-router
export type PatternsFromRoutes<TRoutes extends Routes> =
  /* string union of all effective patterns */ string
```

Semantics:

- `PatternsFromRoutes` computes the union of all route patterns reachable in `TRoutes`, including nested mounts with their prefixes applied.
- This type is used to parameterize `createHrefBuilder` so that href construction is restricted to known route patterns at compile time.

---

## Routing Semantics

Routing proceeds left-to-right through the top-level `routes` array. Elements may be middleware, mounts, or routes. Mounts contribute a subtree; the algorithm conceptually flattens mounts by prefixing their descendants' patterns with the effective mount prefix.

Important: Middleware is not executed until after a matching route has been found. Once a route is determined to match (by method and pattern), the router constructs a middleware chain consisting of all middleware that precede that route in the effective route hierarchy (including middleware defined in enclosing mounts and earlier siblings in that scope), in the order they appeared. That chain executes around the selected route handler.

### Request Preparation

1. Construct `URL` from `request.url`.
2. Initialize an empty per-request context store for `context.set/get`.
3. Construct the initial `RoutingContext` with `request`, `url`, and empty `params`.

### Matching and Execution Flow

1. Compute the effective list of candidate routes by walking the routes array depth-first, applying mount prefixes, and collecting route entries with their method and effective pattern. Ignore middleware at this stage; record their positions for later.
2. Find the first candidate route whose method matches the request method (including ANY) and whose pattern matches the URL.
   - Method check: For specific methods (GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS), compare against `request.method.toUpperCase()`. For `HEAD` and `OPTIONS`, apply special handling described above.
   - Pattern match: Use `RoutePattern.match(url)` with the effective pattern and extract `params`.
3. If no route matches, return `new Response('Not Found', { status: 404 })`.
4. Build the middleware chain for the matched route by concatenating, in order of appearance:
   - Middleware defined in outer mounts enclosing the route (from outermost to innermost), and
   - Middleware entries that appear earlier than the route within the same scope.
5. Execute the middleware chain around the route handler using the Middleware Execution Semantics below.

### Middleware Execution Semantics

Middleware entries create a chain that can observe or short-circuit routing. Given a contiguous set of middleware at a position in the `routes` array, the chain composes as follows:

Pseudo-code:

```ts
async function runMiddlewareChain(
  middleware: Middleware[],
  runDownstream: () => Promise<Response>,
): Promise<Response> {
  let index = -1
  async function dispatch(i: number): Promise<Response> {
    if (i <= index) throw new Error('next() called multiple times')
    index = i
    let fn = middleware[i]
    if (!fn) return runDownstream()
    let calledNext = false
    let responseFromNext: Response | undefined
    let response = await fn(context, async () => {
      calledNext = true
      responseFromNext = await dispatch(i + 1)
      return responseFromNext
    })
    if (response instanceof Response) return response
    // If undefined was returned:
    // - If the middleware called next(), use the downstream response it produced
    // - If it did not, invoke downstream automatically
    if (calledNext) return responseFromNext as Response
    return runDownstream()
  }
  return dispatch(0)
}
```

Notes:

- Middleware may be sync or async. The router always awaits them.
- Middleware can modify downstream responses by awaiting `next()` and returning a different `Response`.
- If a middleware throws, the error propagates; no implicit catch is specified.

### Error Handling Semantics

- The router does not catch errors thrown by middleware or route handlers. Errors propagate to the caller of `router.fetch()`.
- Middleware may use `try/catch` around `await next()` to handle errors thrown from downstream middleware or the matched route handler and convert them into `Response` objects.
- Top-level callers embedding the router (e.g., servers) may wrap `await router.fetch(request)` in a `try/catch` to log errors and return an appropriate error `Response`.
- Implementations SHOULD avoid swallowing errors silently; either return a `Response` or rethrow.

### Mount Semantics and Prefix Normalization

- Each `mount(prefix, routes)` pushes a new effective prefix onto a stack. When entering a mount, join the current effective prefix and the mount prefix using a one-slash normalization: collapse any `.../` + `/...` boundary into a single `/`. A trailing slash on the parent prefix is ignored.
- Mounts can contain routes, middleware, and further mounts. Middleware inside a mount only applies to entries within that mount.

### Context Semantics

- `context.set(key, value)`: associates `value` with `key` for the lifetime of the current request.
- `context.get(key)`:
  - If a value is present, returns it.
  - Else, if `key` has a `defaultValue` property, returns that value.
  - Else, throws `UnsetContextError`.
- Keys should be identity-stable singletons (e.g., module-scoped `Symbol('CurrentUser')` or exported unique objects). To share across modules, export/import the same key object. To share across processes, prefer `Symbol.for(...)` if needed.

---

## Type-level Utilities

### PatternsFromRoutes

`PatternsFromRoutes<TRoutes>` computes a string union of all effective route patterns reachable from `TRoutes` after applying mount prefixes. It ignores middleware entries. For example:

```ts
const routes = [
  route('/', () => new Response('home')),
  mount('/admin', [
    route.get('/', () => new Response('admin')),
    mount('dashboard', [route('/', () => new Response('admin dashboard'))]),
  ]),
] as const

type P = PatternsFromRoutes<typeof routes>
// P = '/' | '/admin' | '/admin/dashboard'
```

This type is intended to feed into `createHrefBuilder<P>()` from `@remix-run/route-pattern` to produce type-safe hrefs.

---

## Compliance with README Examples

The above API and semantics are sufficient to support:

- Route declarations via `route('/', handler)` and `route.<method>(pattern, handler)`.
- Longhand route object form with `method`, `pattern`, and `handler`.
- Middleware via `use(logger, responseLogger)` including auto-`next()` semantics when returning `undefined`.
- Custom context via `context.set(key, value)` and `context.get(key)` with `defaultValue` support and `UnsetContextError` when unset.
- Mounting `mount('/admin', [...])` and nested `mount('dashboard', [...])` with single-slash prefix joining.
- `createRouter({ routes }).fetch(request)` returning a `Response` and defaulting to 404 when no route matches.

---

## Notes and Edge Cases

- Method defaults: `route(pattern, handler)` matches ANY method; the longhand `method` property narrows when set; the `.get/.post/...` helpers narrow by construction.
- Case-insensitive routes: Use `new RoutePattern('/path', { ignoreCase: true })` on a per-route basis, as supported by `@remix-run/route-pattern`.
- Param extraction/type: `params` adhere to `Params<TPattern>` from `@remix-run/route-pattern` and reflect the matched pattern, including mount prefixes.
- URL in context: `context.url` is a `URL` constructed from `request.url` and, where applicable, may be replaced/enhanced by the `match` result returned from `route-pattern` if it provides one.
- Response.redirect usage is unchanged; routes/middleware can return any valid Fetch `Response`.
