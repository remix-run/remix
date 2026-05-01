BREAKING CHANGE: `router.map(routes, controller)` now treats controllers as shallow route-map owners. Controller actions may only include direct route leaves from the route map passed to `router.map()`. Nested route-map keys must be mapped with a separate `router.map()` call, unknown action keys throw at runtime, and direct leaf routes still require matching actions.

Before this change, a controller could mirror a nested route-map tree:

```ts
router.map(routes, {
  middleware: [requireAuth()],
  actions: {
    home,
    account: {
      actions: {
        settings,
      },
    },
  },
})
```

Now each route map gets its own controller and its own explicit registration:

```ts
router.map(routes, {
  actions: { home },
})

router.map(routes.account, {
  middleware: [requireAuth()],
  actions: { settings },
})
```

Controller middleware is shallow as well. Middleware on the root controller only runs for the direct actions in that controller; it is not inherited by controllers registered for nested route maps. Move shared protection such as `requireAuth()` or `requireAdmin()` onto every nested controller that needs it, or keep truly global behavior in the router-level middleware stack.
