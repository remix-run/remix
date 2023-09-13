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

- [Fullstack Data Flow][fullstack-data-flow]
- [State Management][state-management]

**API**

- [`loader`][loader]
- [`useFetcher`][use-fetcher]

[fullstack-data-flow]: ../discussion/data-flow
[state-management]: ../discussion/state-management
[loader]: ../route/loader
[use-fetcher]: ./use-fetcher
