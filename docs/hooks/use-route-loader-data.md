---
title: useRouteLoaderData
toc: false
---

# `useRouteLoaderData`

<docs-info>This hook is simply a re-export of [React Router `useRouteLoaderData`][rr-userouteloaderdata].</docs-info>

Pass in a route ID and it will return the loader data for that route.

```tsx
import { useRouteLoaderData } from "@remix-run/react";

function SomeComponent() {
  const { user } = useRouteLoaderData("root");
}
```

Remix creates the route IDs automatically. They are simply the path of the route file relative to the app folder without the extension.

| Route Filename             | Route ID             |
| -------------------------- | -------------------- |
| `app/root.tsx`             | `"root"`             |
| `app/routes/teams.tsx`     | `"routes/teams"`     |
| `app/routes/teams.$id.tsx` | `"routes/teams.$id"` |

<docs-info>For more information and usage, please refer to the [React Router `useRouteLoaderData` docs][rr-userouteloaderdata].</docs-info>

[rr-userouteloaderdata]: https://reactrouter.com/hooks/use-route-loader-data
