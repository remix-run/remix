BREAKING CHANGE: `router.map(routes, controller)` now maps a controller to the direct leaf routes in the route map passed to `router.map()`. Controller actions may only include direct route leaves from that route map. Nested route-map keys must be mapped with a separate `router.map()` call, unknown action keys throw at runtime, and direct leaf routes still require matching actions.

If an app currently maps nested route maps in one `router.map()` call:

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

Map each route map to its own controller:

```ts
router.map(routes, {
  actions: { home },
})

router.map(routes.account, {
  middleware: [requireAuth()],
  actions: { settings },
})
```

Controller middleware only runs for the direct actions in that controller; it is not inherited by controllers registered for nested route maps. Move shared protection such as `requireAuth()` or `requireAdmin()` onto every controller that needs it, or keep truly global behavior in the router-level middleware stack.
