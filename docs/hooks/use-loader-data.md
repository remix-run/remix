---
title: useLoaderData
---

# `useLoaderData`

Returns the serialized data from the closest route [`loader`][loader].

```tsx lines=[2,9]
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return json(await fakeDb.invoices.findAll());
}

export default function Invoices() {
  const invoices = useLoaderData<typeof loader>();
  // ...
}
```

## Additional Resources

**Discussions**

- [Fullstack Data Flow][fullstack_data_flow]
- [State Management][state_management]

**API**

- [`loader`][loader]
- [`useFetcher`][use_fetcher]

[loader]: ../route/loader
[fullstack_data_flow]: ../discussion/data-flow
[state_management]: ../discussion/state-management
[use_fetcher]: ./use-fetcher
