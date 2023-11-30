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
  return { ok: true };
};
```

This function is only ever run on the client, and can used in a few ways:

- Instead of a server action for full-client routes
- To use alongside a `clientLoader` cache by invalidating the cache on mutations
  - Maintaining a client-side cache to skip calls to the server
  - Bypassing the Remix [BFF][bff] hop and hitting your API directly from the client
- To further augment data loaded from the server
  - I.e., loading user-specific preferences from `localStorage`

## Hydration Behavior

By default, `clientLoader` **will not** execute for the route during initial hydration. This is for the primary (and simpler) use-case where the `clientLoader` does not change the shape of the server `loader` data and is just an optimization on subsequent client side navigations (to read from a cache or hit an API directly).

```tsx
export async function loader() {
  // Server-side, we talk to the DB directly
  const data = getServerDataFromDb();
  return json(data);
}

// This will not run on hydration, and will run on subsequent client-side navigations
export async function clientLoader({
  request,
  params,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  // Client-side, we hit our exposed API endpoints directly
  const data = await fetcDataFromApi();
  return data;
}

// This will render on the server
export default function Component() {
  const data = useLoaderData<typeof loader>();
  return <>...</>;
}
```

### `clientLoader.hydrate`

If you need to run your clientLoader on hydration, you can opt-into that by setting `clientLoader.hydrate=true`. This will tell Remix that it needs to run the `clientLoader` on hydration to get a complete set of loader data. The impact of this is that Remix can no longer server-render the route component because the loader data is not complete with only the server data. Therefore, you can (and should!) export a `HydrateFallback` component for Remix to render on the server. Remix will then run the `clientLoader` on hydration and render the default route component once completed.

```tsx
export async function loader() {
  const data = getServerData();
  return json(data);
}

// This *will* run on hydration
export async function clientLoader({
  request,
  params,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  const [serverData, preferences] = await Promise.all([
    serverLoader(),
    getUserPreferences(),
  ]);
  return {
    ...serverData,
    preferences,
  };
}
clientLoader.hydrate = true;

// This will render on the server
export function HydrateFallback() {
  return <p>Loading user preferences...</p>;
}

// This will render on the client once clientLoader has completed
export default function Component() {
  const data = useLoaderData<typeof clientLoader>();
  return <>...</>;
}
```

If you have multiple routes with `clientLoader.hydrate=true`, then Remix will server-render up until the highest-discovered `HydrateFallback`. You cannot render an `<Outlet/>` in a `HydrateFallback` because children routes can't be guaranteed to operate correctly since their ancestor loader data may not yet be available if they are running `clientLoader` functions on hydration (i.e., use cases such as `useRouteLoaderData()` or `useMatches()`).

## Arguments

### `params`

This function receives the same [`params`][loader-params] argument as a [`loader`][loader].

### `request`

This function receives the same [`request`][loader-request] argument as a [`loader`][loader].

### `serverLoader`

`serverLoader` is an asynchronous function to get the data from the server `loader` for this route. On client-side navigations, this will make a [fetch][fetch] call to the Remix server loader. If you opt-into running your `clientLoader` on hydration, then this function will return you the data that was already loaded on the server (via `Promise.resolve`).

[loader]: ./loader
[loader-params]: ./loader#params
[loader-request]: ./loader#request
[bff]: ../guides/bff
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
