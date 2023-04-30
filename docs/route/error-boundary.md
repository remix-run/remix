---
title: ErrorBoundary
---

# `ErrorBoundary`

<docs-warning>The behaviors of `CatchBoundary` and `ErrorBoundary` are changing in v2. You can prepare for this change at your convenience with the `v2_errorBoundary` future flag. For instructions on making this change see the [v2 guide][v2guide].</docs-warning>

An `ErrorBoundary` is a React component that renders whenever there is an error anywhere on the route, either during rendering or during data loading. We use the word "error" to mean an uncaught exception; something you didn't anticipate happening. You can intentionally throw a `Response` to render the `CatchBoundary`, but everything else that is thrown is handled by the `ErrorBoundary`.

A Remix `ErrorBoundary` component works just like normal React [error boundaries][error-boundaries], but with a few extra capabilities. When there is an error in your route component, the `ErrorBoundary` will be rendered in its place, nested inside any parent routes. `ErrorBoundary` components also render when there is an error in the `loader` or `action` functions for a route, so all errors for that route may be handled in one spot.

An `ErrorBoundary` component receives one prop: the `error` that occurred.

```tsx
export function ErrorBoundary({ error }) {
  return (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
      <p>The stack trace is:</p>
      <pre>{error.stack}</pre>
    </div>
  );
}
```

[error-boundaries]: https://reactjs.org/docs/error-boundaries.html
[error-boundary-v2]: ./error-boundary-v2
[v2guide]: ../pages/v2#catchboundary-and-errorboundary
