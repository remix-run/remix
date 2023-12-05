---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
"@remix-run/testing": minor
---

Add support for `clientLoader`/`clientAction`/`HydrateFallback` route exports ([RFC](https://github.com/remix-run/remix/discussions/7634)).

Remix now supports loaders/actions that run on the client (in addition to, or instead of the loader/action that runs on the server). While we still recommend server loaders/actions for the majority of your data needs in a Remix app - these provide some levers you can pull for more advanced use-cases such as:

- Leveraging a data source local to the browser (i.e., `localStorage`)
- Managing a client-side cache of server data (like `IndexedDB`)
- Bypassing the Remix server in a BFF setup nd hitting your API directly from the browser
- Migrating a React Router SPA to a Remix application

By default, `clientLoader` will not run on hydration, and will only run on subsequent client side navigations.

If you wish to run your client loader on hydration, you can set `clientLoader.hydrate=true` to force Remix to execute it on initial page load. Keep in mind that Remix will still SSR your route component so you should ensure that there is no new _required_ data being added by your `clientLoader`.

If your `clientLoader` neds to run on hydration and adds data you require to render the route component, you can export a `HydrateFallback` component that will render during SSR, and then your route component will not render until the `clientLoader` has executed on hydration.

`clientAction1` is simpler than `clientLoader` because it has no hydration use-cases. `clientAction` will only run on client-side navigations.

For more information, please refer to the [`clientLoader`](https://remix.run/route/client-loader) and [`clientAction`](https://remix.run/route/client-action) documentation.
