---
title: HydrateFallback
---

# `HydrateFallback`

<docs-info>The `HydrateFallback` component is only relevant when you are also setting [`clientLoader.hydrate=true`][hydrate-true] on a given route.</docs-info>

When provided, a `HydrateFallback` component will be rendered during SSR instead of your default route component, because you need to run your `clientLoader` to get a complete set of loader data. The `clientLoader` will then be called on hydration and once completed, Remix will render your route component with the complete loader data.

The most common use-case for this is augmenting your server data with client-side data, such as saved user preferences:

```tsx
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

If you have multiple routes with `clientLoader.hydrate=true`, then Remix will server-render up until the highest-discovered `HydrateFallback`. You cannot render an `<Outlet/>` in a `HydrateFallback` because children routes can't be guaranteed to operate correctly since their ancestor loader data may not yet be available if they are running `clientLoader` functions on hydration (i.e., use cases such as `useRouteLoaderData()` or `useMatches()`).

[hydrate-true]: ./client-loader#clientloaderhydrate
