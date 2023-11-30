---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
"@remix-run/testing": minor
---

Add support for `clientLoader`/`clientAction` route exports ([RFC](https://github.com/remix-run/remix/discussions/7634)).

Remix now supports loaders/actions that run on the client (in addition to or instead of the loader/action that runs on the server). While we still recommend server loaders/actions for the majority of your data need sin a Remix app - these provide some levers you can pull for more advanced use-cases such as:

- Leveraging a data source local to the browser (i.e., `localStorage`)
- Managing a client-side cache of server data (like `IndexedDB`)
- Bypassing the Remix server in a BFF setup nd hitting your API directly from the browser

The primary (and simpler) use-case is when the `clientLoader` does not change the shape of the server `loader` data and is just an optimization - and therefore does not need to run on hydration. To use a `clientLoader` in this fashion, you may export one from your route module:

```tsx
export async function loader({ request, params }: LoaderFunctionArgs) {
  const data = await getDataFromDB();
  return json(data);
}

// This will not run on hydration, only on subsequent client-side navs
export async function clientLoader({
  request,
  params,
  serverLoader,
}: ClientLoaderFunctionArgs) {
  const cacheKey = "whatever";
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  // Fetch the data from the server loader
  const serverData = await serverLoader();
  await cache.set(cacheKey, serverData);
  return serverData;
}

// This will render on the server
export default function Component() {
  const data = useLoaderData<typeof loader>();
  return <>...</>;
}
```

If you _need_ to run your `clientLoader` to get a complete set of loader data (either because you don't have a server loader, or because you need to augment the server loader data), you can set `clientLoader.hydrate = true` to force Remix to skip server-rendering of the route component and run the `clientLoader` on hydration. When you do this, you want to export a `HydrateFallback` component that Remix can SSR instead of the default route component:

```tsx
export async function loader({ request, params }: LoaderFunctionArgs) {
  const data = await getDataFromDB();
  return json(data);
}

// This will run on hydration!
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
