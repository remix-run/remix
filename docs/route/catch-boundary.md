---
title: CatchBoundary
---

# `CatchBoundary`

<docs-warning>The separation of `CatchBoundary` and `ErrorBoundary` has been deprecated and Remix v2 will use a singular `ErrorBoundary` for all thrown Responses and Errors. It is recommended that you opt-into the new behavior in Remix v1 via the `future.v2_errorBoundary` flag in your `remix.config.js` file. Please refer to the [ErrorBoundary (v2)][error-boundary-v2] docs for more information.</docs-warning>

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
