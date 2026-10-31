Inline `{ middleware, handler }` actions inside `createController()` and controllers passed to `router.map()` now type their handler with their own action middleware, matching actions registered directly with `router.get()` or created with `createAction()`. Previously, an inline action's handler only saw the controller context, even though its middleware ran. Each action infers its own middleware, so one action's middleware never refines a sibling's context.

```ts
let pageController = createController(pageRoutes, {
  actions: {
    home: {
      middleware: [loadShopApi()],
      handler(context) {
        // Now typed as the value loadShopApi() provides
        let shop = context.get(ShopApi)
        return Response.json(shop.featuredProducts())
      },
    },
    account: accountAction,
  },
})
```

Controller action keys that are not routes in the controller's route map now name the problem in the type error, for example ``Unknown action `report`: no route with this name in the controller's route map``. Explicit type arguments like `createController<typeof routes, AppContext>(...)` still turn off middleware inference, as they do for controller middleware.
