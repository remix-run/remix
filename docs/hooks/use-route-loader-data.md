---
title: useRouteLoaderData
toc: false
---

# `useRouteLoaderData`

Returns the loader data for a given route by ID.

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
