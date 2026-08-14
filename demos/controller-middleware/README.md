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

Then open <http://localhost:44100/parent> in your browser.

Use the navigation bar to move between the parent, child, and grandchild routes. Each page shows its
middleware execution trace, so the grandchild page displays:

```text
router middleware
parent mount middleware
grandchild controller middleware
grandchild action
```

The parent and child controller middleware are absent because controller middleware does not
inherit. The parent mount middleware is present because the grandchild controller was registered
inside the mounted route group.

Run the focused regression tests with:

```sh
pnpm -C demos/controller-middleware test
```
