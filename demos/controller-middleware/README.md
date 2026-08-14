# Controller middleware demo

This demo makes middleware execution visible across a parent, child, and grandchild route. For
readability, the routes, controllers, middleware, and router setup all live in `app/router.ts`.

The route tree is mounted at `/parent`:

```ts
const routes = route({
  index: get('/'),
  child: route('child', {
    index: get('/'),
    grandchild: route('grandchild', {
      index: get('/'),
    }),
  }),
})
```

Each level has its own controller. Controller middleware applies only to actions in that controller,
while the parent mount middleware applies to all three controllers:

```ts
router.mount('/parent', { middleware: [traceMiddleware('parent mount')] }, (parent) => {
  parent.map(routes, parentController)
  parent.map(routes.child, childController)
  parent.map(routes.child.grandchild, grandchildController)
})
```

## Run

```sh
pnpm -C demos/controller-middleware dev
```

Then request each route:

```sh
curl http://localhost:44100/parent
curl http://localhost:44100/parent/child
curl http://localhost:44100/parent/child/grandchild
```

The grandchild route responds with a trace like:

```json
{
  "route": "grandchild",
  "trace": [
    "router middleware",
    "parent mount middleware",
    "grandchild controller middleware",
    "grandchild action"
  ]
}
```

The parent and child controller middleware are absent because controller middleware does not
inherit. The parent mount middleware is present because the grandchild controller was registered
inside the mounted route group.

Run the focused regression tests with:

```sh
pnpm -C demos/controller-middleware test
```
