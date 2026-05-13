BREAKING CHANGE: Simplified route action, controller, request handler, and middleware helper types. `Action` now accepts a route pattern, `RoutePattern`, or `Route` object as its first generic and the full request context as its optional second generic. It describes either a plain request handler function or an action object with optional inline middleware. `Controller` now accepts the route map as its first generic and the full request context as its optional second generic. `RequestHandler` now accepts the full request context as its only generic. `Middleware` now accepts one context effect generic, which can be a single `{ key, value }` context entry, a `ContextEntries` tuple, or a context transform function. `BuildAction` is no longer exported.

For most apps, augment `RouterTypes.context` once and use `createAction()`/`createController()` to type stored handlers without `satisfies` clauses:

```ts
import {
  createAction,
  createController,
  type ContextWithParams,
  type RequestContext,
} from 'remix/router'

type AppContext<params extends Record<string, string> = {}> = ContextWithParams<
  RequestContext,
  params
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

let action = createAction(routes.account, {
  handler(context) {
    return new Response(context.params.id)
  },
})

let controller = createController(routes, {
  actions: {
    account(context) {
      return new Response(context.params.id)
    },
  },
})
```

If you manually type actions or controllers in advanced multi-router code, compose the full context type first and pass it as the second generic:

```ts
import type { Action, MiddlewareContext } from 'remix/router'

let accountMiddleware = [requireAuth<AuthIdentity>()] as const
type AccountContext = MiddlewareContext<typeof accountMiddleware, AppContext>

let action: Action<typeof routes.account, AccountContext> = {
  middleware: accountMiddleware,
  handler(context) {
    let auth = context.get(Auth)
    return Response.json(auth.identity)
  },
}
```

`Action` can be used to manually annotate either action form:

```ts
let handler: Action<typeof routes.account, AccountContext> = (context) => {
  return Response.json(context.get(Auth).identity)
}

let action: Action<typeof routes.account, AccountContext> = {
  middleware: accountMiddleware,
  handler(context) {
    return Response.json(context.get(Auth).identity)
  },
}
```

Renamed the custom router matcher payload type from `MatchData` to `RouteEntry`:

```ts
// before
let matcher = createMatcher<MatchData>()

// after
let matcher = createMatcher<RouteEntry>()
```

If you manually annotate request handlers, pass the full request context type as the only generic:

```ts
// before
let handler: RequestHandler<{ id: string }, RequestContext<{ id: string }>>

// after
let handler: RequestHandler<RequestContext<{ id: string }>>
```

If you manually annotate middleware, pass only the context transform type:

```ts
// before
let middleware: Middleware<{}, SetDatabaseContextTransform>

// after
let middleware: Middleware<{ key: typeof Database; value: Database }>
```

Simplified the public middleware context helper types. `MiddlewareContext` is now the exported helper for deriving the request context produced by a middleware chain, and it accepts an optional base context as its second type parameter. Middleware that provides one context value can use a `{ key, value }` entry directly instead of wrapping the entry in a one-item tuple. The lower-level `MiddlewareContextTransform`, `ContextTransform`, `ApplyContextTransform`, `ApplyMiddleware`, and `ApplyMiddlewareTuple` helpers are no longer exported.

`MiddlewareContext` accepts middleware values, not middleware factory function types. Use `ReturnType<typeof factory>` when a middleware is created by a factory function:

```ts
// before
type AppContext = MiddlewareContext<[typeof session]>

// after
type AppContext = MiddlewareContext<[ReturnType<typeof session>]>
```

```ts
// before
type AppContext = ApplyMiddlewareTuple<RequestContext, typeof middleware>

// after
type AppContext = MiddlewareContext<typeof middleware>
```

```ts
// before
type ActionContext = ApplyMiddlewareTuple<AppContext, typeof actionMiddleware>

// after
type ActionContext = MiddlewareContext<typeof actionMiddleware, AppContext>
```

Renamed request context helper types so their names describe the `RequestContext` type they produce. Use `ContextWithParams` when deriving an app context that includes route params:

```ts
// before
type AppContext<params extends AnyParams = {}> = WithParams<
  MiddlewareContext<typeof middleware>,
  params
>

// after
type AppContext<params extends AnyParams = {}> = ContextWithParams<
  MiddlewareContext<typeof middleware>,
  params
>
```

Use `ContextWithEntries` when manually composing one or more context entries without a middleware tuple:

```ts
// before
type CurrentUserContext = MergeContext<AppContext, [readonly [typeof CurrentUser, User | null]]>

// after
type CurrentUserContext = ContextWithEntries<
  AppContext,
  [{ key: typeof CurrentUser; value: User | null }]
>
```

Use `ContextWithEntry` when refining a single context entry for a specific handler or middleware result:

```ts
// before
type AdminContext = SetContextValue<AppContext, typeof CurrentRole, 'admin'>

// after
type AdminContext = ContextWithEntry<AppContext, { key: typeof CurrentRole; value: 'admin' }>
```

Stored action objects and controllers no longer derive handler context from their local middleware tuple. If local middleware adds context values that a handler requires, compose the full handler context explicitly and pass it to `Action`, `Controller`, `createAction()`, or `createController()`:

```ts
// before
let controller = createController(routes, {
  middleware: [requireAuth<AuthIdentity>()],
  actions: {
    account(context) {
      let auth = context.get(Auth)
      return Response.json(auth.identity)
    },
  },
})

// after
let accountMiddleware = [requireAuth<AuthIdentity>()] as const
type AuthenticatedAppContext = MiddlewareContext<typeof accountMiddleware, AppContext>

let controller = createController<typeof routes, AuthenticatedAppContext>(routes, {
  middleware: accountMiddleware,
  actions: {
    account(context) {
      let auth = context.get(Auth)
      return Response.json(auth.identity)
    },
  },
})
```
