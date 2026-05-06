BREAKING CHANGE: Simplified route action and middleware helper types so they no longer accept unused request method type parameters. If you manually type route actions, pass only the route pattern or route object plus any request context type:

```ts
// before
let action = {
  handler(context) {
    return new Response(context.params.id)
  },
} satisfies BuildAction<'GET', typeof routes.account, AppContext>

// after
let action = {
  handler(context) {
    return new Response(context.params.id)
  },
} satisfies Action<typeof routes.account, AppContext>
```

Renamed the custom router matcher payload type from `MatchData` to `RouteEntry`:

```ts
// before
let matcher = createMatcher<MatchData>()

// after
let matcher = createMatcher<RouteEntry>()
```

If you manually annotate middleware, pass only the params type and context transform type:

```ts
// before
let middleware: Middleware<'ANY', {}, SetDatabaseContextTransform>

// after
let middleware: Middleware<{}, SetDatabaseContextTransform>
```

`Action` now accepts string patterns, `RoutePattern` objects, and `Route` objects directly. It also owns the optional action middleware tuple generic, so `BuildAction` is no longer exported.

For stored action objects with action-local middleware, the handler context can now be derived from the middleware tuple that actually runs. Previously, the action had to repeat the middleware's type effect with a manually refined context type. That was type-safe only as long as the manual context type and the runtime middleware stayed in sync:

```ts
// before
type AuthenticatedAppContext = WithRequiredAuth<AppContext, AuthIdentity>

let action = {
  middleware: [requireAuth<AuthIdentity>()],
  handler(context) {
    let auth = context.get(Auth)
    return Response.json(auth.identity)
  },
} satisfies BuildAction<'GET', typeof routes.account, AuthenticatedAppContext>

// after
let accountMiddleware = [requireAuth<AuthIdentity>()] as const

let action = {
  middleware: accountMiddleware,
  handler(context) {
    let auth = context.get(Auth)
    return Response.json(auth.identity)
  },
} satisfies Action<typeof routes.account, AppContext, typeof accountMiddleware>
```
