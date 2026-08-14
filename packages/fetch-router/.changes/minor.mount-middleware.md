Add optional second `{ middleware }` argument to `router.mount()` so one middleware boundary can apply to every route, nested mount, and controller registered by a route installer. Middleware-provided context and mount params are inferred in descendant handlers.

```ts
router.mount('/admin', { middleware: [requireAdmin()] }, (admin) => {
  admin.map(adminRoutes, adminController)
  admin.map(settingsRoutes, settingsController)
})
```
