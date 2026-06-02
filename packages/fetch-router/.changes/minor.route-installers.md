Add `router.mount()` and the `RouteBuilder`/`RouteInstaller` types so route groups can be written as local, reusable pieces of an app instead of hard-coding the full URL where they happen to live today. A route installer receives a prefixed route builder that can register routes with the same `route()`, `map()`, and method helpers as a router, while the parent router remains responsible for dispatch, matching, middleware, and default 404 handling.

Before `router.mount()`, route groups that lived in separate modules still needed to know where they were installed. That usually meant passing the root router around and repeating the parent path inside every route, which made feature code harder to move, reuse, or mount in more than one place:

```ts
import { createRouter, type Router } from 'remix/router'

function installAdminRoutes(router: Router<AppContext>) {
  router.get('/admin', () => new Response('Admin'))
  router.get('/admin/users/:id', ({ params }) => new Response(params.id))
}

let router = createRouter<AppContext>({ middleware })
installAdminRoutes(router)
```

Now the route group describes only its own local routes, and the parent decides where that group belongs:

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

Mount prefixes are route patterns, so params from the prefix are available in mounted handlers. This makes common nested app shapes like org-scoped settings, account dashboards, API versions, and admin sections type naturally without each child route repeating the scope prefix:

```ts
router.mount('/orgs/:orgId', (org) => {
  org.get('/users/:userId', ({ params }) => {
    return new Response(`${params.orgId}:${params.userId}`)
  })
})
```

If a mount prefix and child route use the same param name, the right-most route param wins, matching `route-pattern` behavior.

Add `RouterContext<typeof router>` for extracting the request context provided by a router or route builder. This lets apps keep root middleware inline and derive the app context from the router itself instead of storing a middleware tuple only so another type can refer to it:

```ts
export const router = createRouter({
  middleware: [loadSession(), loadDatabase()],
})

type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}
```

Make middleware context inference line up with the code people actually want to write. `createAction()`, direct action objects registered with `route()`, single-route `map()`, or method helpers, and `createController()` now infer middleware-provided values from plain inline middleware arrays.

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

Now the inline middleware array on the action, route, or controller is enough for the handler to see the values it provides:

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

Add `createMiddleware()` for the few cases where a reusable middleware chain must preserve its exact tuple type without `as const`. Prefer plain inline arrays for `middleware` options on routers, controllers, actions, and route helpers. Use `createMiddleware()` when a chain crosses a TypeScript inference boundary, such as deriving `MiddlewareContext<typeof rootMiddleware>` without a router value, exporting a reusable chain, or returning a chain from a factory.

`Middleware` is now modeled as a callable type alias with type-only context metadata instead of an interface call signature. Middleware provider APIs stay the same, but inline middleware arrays preserve their context transforms more reliably for action and controller handlers.

The public router type surface is also smaller and easier to explain: `createRouter()` and `router.map()` each use a single call signature while preserving route params, middleware context inference, and stored action/controller compatibility checks.

BREAKING CHANGE: `MapTarget` and `MapHandler` are no longer exported. These helper types existed to express the implementation of `router.map()` and were not needed for application code. Use the public `Router`, `RouteBuilder`, `RouteInstaller`, `Action`, and `Controller` types to describe router setup code.
