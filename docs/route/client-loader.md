---
title: clientLoader
---

# `clientLoader`

In addition to (or in place of) your [`loader`][loader], you may define a `clientLoader` function that will execute on the client.

Each route can define a `clientLoader` function that provides data to the route when rendering:

```tsx
export const clientLoader = async ({
  request,
  params,
  serverLoader,
}: ClientLoaderFunctionArgs) => {
  // call the server loader
  const serverData = await serverLoader();
  // And/or fetch data on the client
  const data = getDataFromClient();
  // Return the data to expose through useLoaderData()
  return data;
};
```

This function is only ever run on the client and can be used in a few ways:

- Instead of a server `loader` for full-client routes
- To use alongside a `clientLoader` cache by invalidating the cache on mutations
  - Maintaining a client-side cache to skip calls to the server
  - Bypassing the Remix [BFF][bff] hop and hitting your API directly from the client
- To further augment data loaded from the server
  - I.e., loading user-specific preferences from `localStorage`
- To facilitate a migration from React Router

## Hydration Behavior

By default, `clientLoader` **will not** execute for the route during hydration of your Remix app on the initial SSR document request. This is for the primary (and simpler) use-case where the `clientLoader` does not change the shape of the server `loader` data and is just an optimization on subsequent client side navigations (to read from a cache or hit an API directly).

```tsx
export async function loader() {
  // During SSR, we talk to the DB directly
  const data = getServerDataFromDb();
  return json(data);
}

export async function clientLoader() {
  // During client-side navigations, we hit our exposed API endpoints directly
  const data = await fetchDataFromApi();
  return data;
}

export default function Component() {
  const data = useLoaderData<typeof loader>();
  return <>...</>;
}
```

### `clientLoader.hydrate`

If you need to run your `clientLoader` during hydration on the initial document request, you can opt in by setting `clientLoader.hydrate=true`. This will tell Remix that it needs to run the `clientLoader` on hydration. Without a `HydrateFallback`, your route component will be SSR'd with the server `loader` data - and then `clientLoader` will run and the returned data will be updated in-place in the hydrated route Component.

<docs-info>If a route exports a `clientLoader` and does not export a server `loader`, then `clientLoader.hydrate` is automatically treated as `true` since there is no server data to SSR with. Therefore, we always need to run the `clientLoader` on hydration before rendering the route component.</docs-info>

### HydrateFallback

If you need to avoid rendering your default route component during SSR because you have data that must come from a `clientLoader`, you can export a [`HydrateFallback`][hydratefallback] component from your route that will be rendered during SSR, and only once the `clientLoader` runs on hydration will your router component be rendered.

## Arguments

### `params`

This function receives the same [`params`][loader-params] argument as a [`loader`][loader].

### `request`

This function receives the same [`request`][loader-request] argument as a [`loader`][loader].

### `serverLoader`

`serverLoader` is an asynchronous function to get the data from the server `loader` for this route. On client-side navigations, this will make a [fetch][fetch] call to the Remix server `loader`. If you opt-into running your `clientLoader` on hydration, then this function will return you the data already loaded on the server (via `Promise.resolve`).

See also:

- [Client Data Guide][client-data-guide]
- [HydrateFallback][hydratefallback]
- [clientAction][clientaction]

[loader]: ./loader
[loader-params]: ./loader#params
[loader-request]: ./loader#request
[clientaction]: ./client-action
[hydratefallback]: ./hydrate-fallback
[bff]: ../guides/bff
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[client-data-guide]: ../guides/client-data
