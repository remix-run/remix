---
title: Client Data
---

# Client Data

Remix introduced support for "Client Data" ([RFC][rfc]) in [`v2.4.0`][2.4.0] which allows you to opt-into running route loaders/actions in the browser via [`clientLoader`][clientloader]/[`clientAction`][clientaction] exports from your route.

These new exports are a bit of a sharp knife and are not recommended as your _primary_ data loading/submission mechanisms — but instead give you a lever to pull on for some of the following advanced use cases:

- **Skip the Hop:** Query a data API directly from the browser, using loaders simply for SSR
- **Fullstack State:** Augment server data with client data for your full set of loader data
- **One or the Other:** Sometimes you use server loaders, sometimes you use client loaders, but not both on one route
- **Client Cache:** Cache server loader data in the client and avoid some server calls
- **Migration:** Ease your migration from React Router → Remix SPA → Remix SSR (once Remix supports [SPA Mode][rfc-spa])

Please use these new exports with caution! If you're not careful — it's straightforward to get your UI out of sync. Remix out of the box tries _very_ hard to ensure that this doesn't happen - but once you take control over your own client-side cache, and potentially prevent Remix from performing its normal server `fetch` calls - then Remix can no longer guarantee your UI remains in sync.

## Skip the Hop

When using Remix in a [BFF][bff] architecture, it may be helpful to skip the Remix server hop and hit your backend API directly. This assumes you are able to handle authentication accordingly and are not subject to CORS issues. You can skip the Remix BFF hop as follows:

1. Load the data from server `loader` on the document load
2. Load the data from the `clientLoader` on all later loads

In this scenario, Remix will _not_ call the `clientLoader` on hydration - and will only call it on later navigations.

```tsx lines=[8,15]
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const data = await fetchApiFromServer({ request }); // (1)
  return json(data);
}

export async function clientLoader({
  request,
}: ClientLoaderFunctionArgs) {
  const data = await fetchApiFromClient({ request }); // (2)
  return data;
}
```

## Fullstack State

Sometimes, you may want to leverage "Fullstack State" where some of your data comes from the server, and some of your data comes from the browser (i.e., `IndexedDB` or other browser SDKs) - but you can't render your component until you have the combined set of data. You can combine these two data sources as follows:

1. Load the partial data from server `loader` on the document load
2. Export a [`HydrateFallback`][hydratefallback] component to render during SSR because we don't yet have a full set of data
3. Set `clientLoader.hydrate = true`, this instructs Remix to call the clientLoader as part of initial document hydration
4. Combine the server data with the client data in `clientLoader`

```tsx lines=[8-10,23-24,27,30]
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const partialData = await getPartialDataFromDb({
    request,
  }); // (1)
  return json(partialData);
}

export async function clientLoader({
  request,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  const [serverData, clientData] = await Promise.all([
    serverLoader(),
    getClientData(request),
  ]);
  return {
    ...serverData, // (4)
    ...clientData, // (4)
  };
}
clientLoader.hydrate = true; // (3)

export function HydrateFallback() {
  return <p>Skeleton rendered during SSR</p>; // (2)
}

export default function Component() {
  // This will always be the combined set of server and client data
  const data = useLoaderData();
  return <>...</>;
}
```

## One or the Other

You may want to mix and match data loading strategies in your application such that some routes only load data on the server and some routes only load data on the client. You can choose per route as follows:

1. Export a `loader` when you want to use server data
2. Export `clientLoader` and a `HydrateFallback` when you want to use client data

A route that only depends on a server loader looks like this:

```tsx filename=app/routes/server-data-route.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const data = await getServerData(request);
  return json(data);
}

export default function Component() {
  const data = useLoaderData(); // (1) - server data
  return <>...</>;
}
```

A route that only depends on a client loader looks like this.

```tsx filename=app/routes/client-data-route.tsx
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

export async function clientLoader({
  request,
}: ClientLoaderFunctionArgs) {
  const clientData = await getClientData(request);
  return clientData;
}
// Note: you do not have to set this explicitly - it is implied if there is no `loader`
clientLoader.hydrate = true;

// (2)
export function HydrateFallback() {
  return <p>Skeleton rendered during SSR</p>;
}

export default function Component() {
  const data = useLoaderData(); // (2) - client data
  return <>...</>;
}
```

## Client Cache

You can leverage a client-side cache (memory, local storage, etc.) to bypass certain calls to the server as follows:

1. Load the data from server `loader` on the document load
2. Set `clientLoader.hydrate = true` to prime the cache
3. Load later navigations from the cache via `clientLoader`
4. Invalidate the cache in your `clientAction`

Note that since we are not exporting a `HydrateFallback` component, we will SSR the route component and then run the `clientLoader` on hydration, so it's important that your `loader` and `clientLoader` return the same data on initial load to avoid hydration errors.

```tsx lines=[14,36,42,49,56]
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import type {
  ClientActionFunctionArgs,
  ClientLoaderFunctionArgs,
} from "@remix-run/react";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const data = await getDataFromDb({ request }); // (1)
  return json(data);
}

export async function action({
  request,
}: ActionFunctionArgs) {
  await saveDataToDb({ request });
  return json({ ok: true });
}

let isInitialRequest = true;

export async function clientLoader({
  request,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  const cacheKey = generateKey(request);

  if (isInitialRequest) {
    isInitialRequest = false;
    const serverData = await serverLoader();
    cache.set(cacheKey, serverData); // (2)
    return serverData;
  }

  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return cachedData; // (3)
  }

  const serverData = await serverLoader();
  cache.set(cacheKey, serverData);
  return serverData;
}
clientLoader.hydrate = true; // (2)

export async function clientAction({
  request,
  serverAction,
}: ClientActionFunctionArgs) {
  const cacheKey = generateKey(request);
  cache.delete(cacheKey); // (4)
  const serverData = await serverAction();
  return serverData;
}
```

## Migration

We expect to write up a separate guide for migrations once [SPA Mode][rfc-spa] lands, but for now we expect that the process will be something like:

1. Introduce data patterns in your React Router SPA by moving to `createBrowserRouter`/`RouterProvider`
2. Move your SPA to use Vite to better prepare for the Remix migration
3. Incrementally move to file-based route definitions via the use of a Vite plugin (not yet provided)
4. Migrate your React Router SPA to Remix SPA Mode where all current file-based `loader` function act as `clientLoader`
5. Opt out of Remix SPA Mode (and into Remix SSR mode) and find/replace your `loader` functions to `clientLoader`
   - You're now running an SSR app, but all your data loading is still happening in the client via `clientLoader`
6. Incrementally start moving `clientLoader -> loader` to start moving data loading to the server

[rfc]: https://github.com/remix-run/remix/discussions/7634
[2.4.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v240
[clientloader]: ../route/client-loader
[clientaction]: ../route/client-action
[hydratefallback]: ../route/hydrate-fallback
[rfc-spa]: https://github.com/remix-run/remix/discussions/7638
[bff]: ../guides/bff
