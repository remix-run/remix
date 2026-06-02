Add `router.mount()` and the `RouteBuilder`/`RouteInstaller` types for composing route groups under route pattern prefixes. A route installer receives a prefixed route builder that can register routes with the same `route()`, `map()`, and method helpers as a router, while the parent router remains responsible for dispatch, matching, middleware, and default 404 handling.

Before `router.mount()`, route groups that lived in separate modules still needed to know where they were installed. That usually meant passing the root router around and repeating the parent path inside every route:

```ts
import { createRouter, type Router } from 'remix/router'

function installAdminRoutes(router: Router<AppContext>) {
  router.get('/admin', () => new Response('Admin'))
  router.get('/admin/users/:id', ({ params }) => new Response(params.id))
}

let router = createRouter<AppContext>({ middleware })
installAdminRoutes(router)
```

Now the route group can describe itself locally, and the parent decides where that group belongs:

```ts
import { createRouter, type RouteBuilder } from 'remix/router'

function installAdminRoutes<context extends AppContext>(router: RouteBuilder<context>) {
  router.get('/', () => new Response('Admin'))
  router.get('/users/:id', ({ params }) => new Response(params.id))
}

let router = createRouter<AppContext>({ middleware })
router.mount('/admin', installAdminRoutes)
router.mount('/internal/admin', installAdminRoutes)
```

Mount prefixes are route patterns, so params from the prefix are available in mounted handlers:

```ts
router.mount('/orgs/:orgId', (org) => {
  org.get('/users/:userId', ({ params }) => {
    return new Response(`${params.orgId}:${params.userId}`)
  })
})
```

If a mount prefix and child route use the same param name, the right-most route param wins, matching `route-pattern` behavior.

Add `createMiddleware()` for creating reusable middleware chains that preserve their tuple type without `as const`. Prefer inline arrays for `middleware` options on routers, controllers, and actions; use `createMiddleware()` when a chain is stored in a variable and its exact tuple type needs to survive that boundary, such as when deriving `MiddlewareContext<typeof rootMiddleware>`, exporting a reusable chain, or returning a chain from a factory.

`createAction()` and action objects registered directly with `route()`, single-route `map()`, or method helpers also infer action middleware into handler context. `createController()` infers controller middleware into its action handlers, so middleware-provided values are available from inline middleware arrays without manually composing a separate context type.

`context.router` is now typed as `RequestRouter`, a request-time router reference with `fetch()` only. This keeps request handlers and middleware focused on dispatching through the active router while route installation remains a setup-time concern handled by `Router` and `RouteBuilder`.

The public router type surface is also simpler: `createRouter()` and `router.map()` each use a single call signature while preserving the same route params, middleware context inference, and stored action/controller compatibility checks.

Before this inference, stored actions and controllers that depended on middleware-provided values had to manually compose an intermediate context type:

```ts
let adminMiddleware = createMiddleware(requireAdmin())
type AdminContext = MiddlewareContext<typeof adminMiddleware, AppContext>

let adminAction = createAction<typeof routes.admin, AdminContext>(routes.admin, {
  middleware: adminMiddleware,
  handler({ admin }) {
    return new Response(admin.id)
  },
})
```

Now the inline middleware array on the action or controller is enough for the handler to see the values it provides:

```ts
let adminAction = createAction(routes.admin, {
  middleware: [requireAdmin()],
  handler({ admin }) {
    return new Response(admin.id)
  },
})

router.get(routes.admin, {
  middleware: [requireAdmin()],
  handler({ admin }) {
    return new Response(admin.id)
  },
})

let adminController = createController(routes.admin, {
  middleware: [requireAdmin()],
  actions: {
    dashboard({ admin }) {
      return new Response(admin.id)
    },
  },
})
```
