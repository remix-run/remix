BREAKING CHANGE: Updated the re-exported `remix/fetch-router` helper types to match `@remix-run/fetch-router`: `Action` and `Controller` now accept the full request context as their optional second generic, `RequestHandler` now accepts the full request context as its only generic, `Middleware` now accepts only the context transform generic, `BuildAction` is no longer exported, `createAction()`/`createController()` are the preferred helpers for stored handlers, `RouterTypes.context` configures the default builder context, `MiddlewareContext` now accepts an optional base context, `ContextWithMiddleware` applies middleware to an existing context, `ContextTransform` replaces `MiddlewareContextTransform`, the lower-level `ApplyContextTransform`/`ApplyMiddleware`/`ApplyMiddlewareTuple` helpers are no longer exported, and custom matcher payloads should use `RouteEntry` instead of `MatchData`.

The request context helper type renames also apply to imports from `remix/fetch-router`.

Use `ContextWithParams` when deriving an app context that includes route params:

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

Use `ContextWithValues` when a middleware package provides one or more context values:

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

Use `ContextWithValue` when refining a single context value for a specific handler or middleware result:

```ts
// before
type AdminContext = SetContextValue<AppContext, typeof CurrentRole, 'admin'>

// after
type AdminContext = ContextWithValue<AppContext, typeof CurrentRole, 'admin'>
```

For most apps, augment `RouterTypes.context` once and use `createController()` instead of repeating a `satisfies Controller<...>` clause on every controller:

```ts
// before
type AuthenticatedAppContext = WithRequiredAuth<AppContext, AuthIdentity>

let controller = {
  middleware: [requireAuth<AuthIdentity>()],
  actions: {
    account(context) {
      let auth = context.get(Auth)
      return Response.json(auth.identity)
    },
  },
} satisfies Controller<typeof routes, AuthenticatedAppContext>

// after
declare module 'remix/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}

let accountMiddleware = [requireAuth<AuthIdentity>()] as const

let controller = createController(routes, {
  middleware: accountMiddleware,
  actions: {
    account(context) {
      let auth = context.get(Auth)
      return Response.json(auth.identity)
    },
  },
})
```
