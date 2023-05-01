---
title: CatchBoundary
---

# `CatchBoundary`

<docs-warning>The behaviors of `CatchBoundary` and `ErrorBoundary` are changing in v2. You can prepare for this change at your convenience with the `v2_errorBoundary` future flag. For instructions on making this change see the [v2 guide][v2guide].</docs-warning>

A `CatchBoundary` is a React component that renders whenever an action or loader throws a `Response`.

**Note:** We use the word "catch" to represent the codepath taken when a `Response` type is thrown; you thought about bailing from the "happy path". This is different from an uncaught error you did not expect to occur.

A Remix `CatchBoundary` component works just like a route component, but instead of `useLoaderData` you have access to `useCatch`. When a response is thrown in an action or loader, the `CatchBoundary` will be rendered in its place, nested inside parent routes.

A `CatchBoundary` component has access to the status code and thrown response data through `useCatch`.

```tsx
import { useCatch } from "@remix-run/react";

export function CatchBoundary() {
  const caught = useCatch();

  return (
    <div>
      <h1>Caught</h1>
      <p>Status: {caught.status}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </div>
  );
}
```

[error-boundary-v2]: ./error-boundary-v2
[v2guide]: ../pages/v2#catchboundary-and-errorboundary
