BREAKING CHANGE: Updated the re-exported `remix/fetch-router` helper types around full request-context types and stored route handlers. `Action`, `Controller`, and `RequestHandler` now take the full request context type, `MiddlewareContext` accepts middleware values plus an optional base context, and `createAction()`/`createController()` are the preferred helpers for stored handlers.

For most apps, configure `RouterTypes.context` once and let `createController()` infer route action context from the route map and controller middleware:

```ts
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
      return Response.json(context.auth.identity)
    },
  },
})
```

Low-level context transform helpers such as `BuildAction`, `MiddlewareContextTransform`, `ContextTransform`, `ApplyContextTransform`, `ApplyMiddleware`, and `ApplyMiddlewareTuple` are no longer exported. Use `ContextWithParams`, `ContextWithEntry`, `ContextWithEntries`, `MiddlewareContext`, and `RouteEntry` when manually composing request context or custom matcher payloads.
