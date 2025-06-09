---
title: HydrateFallback
---

# `HydrateFallback`

A `HydrateFallback` component is your way of informing Remix that you do not want to render your route component until _after_ the `clientLoader` has run on hydration. When exported, Remix will render the fallback during SSR instead of your default route component, and will render your route component client-side once the `clientLoader` completes.

The most common use-cases for this are client-only routes (such as an in-browser canvas game) and augmenting your server data with client-side data (such as saved user preferences).

```tsx filename=routes/client-only-route.tsx
export async function clientLoader() {
  const data = await loadSavedGameOrPrepareNewGame();
  return data;
}
// Note clientLoader.hydrate is implied without a server loader

export function HydrateFallback() {
  return <p>Loading Game...</p>;
}

export default function Component() {
  const data = useLoaderData<typeof clientLoader>();
  return <Game data={data} />;
}
```

```tsx filename=routes/augmenting-server-data.tsx
export async function loader() {
  const data = getServerData();
  return json(data);
}

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

export function HydrateFallback() {
  return <p>Loading user preferences...</p>;
}

export default function Component() {
  const data = useLoaderData<typeof clientLoader>();
  if (data.preferences.display === "list") {
    return <ListView items={data.items} />;
  } else {
    return <GridView items={data.items} />;
  }
}
```

There are a few nuances worth noting around the behavior of `HydrateFallback`:

- It is only relevant on initial document request and hydration and will not be rendered on any subsequent client-side navigations
- It is only relevant when you are also setting [`clientLoader.hydrate=true`][hydrate-true] on a given route
- It is also relevant if you do have a `clientLoader` without a server `loader`, as this implies `clientLoader.hydrate=true` since there is otherwise no loader data at all to return from `useLoaderData`
  - Even if you do not specify a `HydrateFallback` in this case, Remix will not render your route component and will bubble up to any ancestor `HydrateFallback` component
  - This is to ensure that `useLoaderData` remains "happy-path"
  - Without a server `loader`, `useLoaderData` would return `undefined` in any rendered route components
- You cannot render an `<Outlet/>` in a `HydrateFallback` because children routes can't be guaranteed to operate correctly since their ancestor loader data may not yet be available if they are running `clientLoader` functions on hydration (i.e., use cases such as `useRouteLoaderData()` or `useMatches()`)

See also:

- [clientLoader][clientloader]

[hydrate-true]: ./client-loader#clientloaderhydrate
[clientloader]: ./client-loader
