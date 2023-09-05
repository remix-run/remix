---
title: useLoaderData
toc: false
---

# `useLoaderData`

Returns the serialized data from the closest route loader.

```tsx lines=[1,8]
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return fakeDb.invoices.findAll();
}

export default function Invoices() {
  const invoices = useLoaderData<typeof loader>();
  // ...
}
```

## Additional Resources

**Discussions**

- [Fullstack Data Flow](../discussion/03-data-flow)
- [State Management](../discussion/08-state-management)

**API**

- [`loader`](../route/loader)
- [`useFetcher`](./use-fetcher)
