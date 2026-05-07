BREAKING CHANGE: Simplified route action, controller, request handler, and middleware helper types. `Action` now describes object-form route handlers only and accepts a route pattern, `RoutePattern`, or `Route` object as its first generic and the full request context as its optional second generic. Use the new `RouteHandler` type when you need to describe either a plain request handler function or an action object. `Controller` now accepts the route map as its first generic and the full request context as its optional second generic. `RequestHandler` now accepts the full request context as its only generic. `Middleware` now accepts only the context transform generic. `BuildAction` is no longer exported.

For most apps, augment `RouterTypes.context` once and use `createAction()`/`createController()` to type stored handlers without `satisfies` clauses:

```ts
import {
  createAction,
  createController,
  type ContextWithParams,
  type RequestContext,
} from 'remix/fetch-router'

type AppContext<params extends Record<string, string> = {}> = ContextWithParams<
  RequestContext,
  params
>

declare module 'remix/fetch-router' {
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
import type { Action, ContextWithMiddleware } from 'remix/fetch-router'

let accountMiddleware = [requireAuth<AuthIdentity>()] as const
type AccountContext = ContextWithMiddleware<AppContext, typeof accountMiddleware>

let action: Action<typeof routes.account, AccountContext> = {
  middleware: accountMiddleware,
  handler(context) {
    let auth = context.get(Auth)
    return Response.json(auth.identity)
  },
}
```

If you used `Action` to annotate a stored route handler function, switch that annotation to `RouteHandler`. `Action` remains available for object-form handlers with optional middleware:

```ts
// before
let handler: Action<typeof routes.account, AccountContext> = (context) => {
  return Response.json(context.get(Auth).identity)
}

// after
let handler: RouteHandler<typeof routes.account, AccountContext> = (context) => {
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
let middleware: Middleware<SetDatabaseContextTransform>
```

Simplified the public middleware context helper types. `MiddlewareContext` is now the exported helper for deriving the request context produced by a middleware chain, and it accepts an optional base context as its second type parameter. `ContextWithMiddleware` is available when code reads more naturally by naming the base context first. The lower-level `ApplyContextTransform`, `ApplyMiddleware`, and `ApplyMiddlewareTuple` helpers are no longer exported. `MiddlewareContextTransform` has been renamed to `ContextTransform`.

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
type ActionContext = ContextWithMiddleware<AppContext, typeof actionMiddleware>
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

Use `ContextWithValues` when a middleware package provides one or more context values. Third-party middleware packages that augment request context should prefer exported helper names like `ContextWithCurrentUser` so their package-specific helpers match the built-in `ContextWith...` naming pattern:

```ts
// before
export type WithCurrentUser<context extends RequestContext<any, any>> = MergeContext<
  context,
  [readonly [typeof CurrentUser, User | null]]
>

// after
export type ContextWithCurrentUser<context extends RequestContext<any, any>> = ContextWithValues<
  context,
  [readonly [typeof CurrentUser, User | null]]
>
```

Use `ContextWithValue` when refining a single context value for a specific handler or middleware result:

```ts
// before
type AdminContext = SetContextValue<AppContext, typeof CurrentRole, 'admin'>

// after
type AdminContext = ContextWithValue<AppContext, typeof CurrentRole, 'admin'>
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
type AuthenticatedAppContext = ContextWithMiddleware<AppContext, typeof accountMiddleware>

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
