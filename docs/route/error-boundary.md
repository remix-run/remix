---
title: ErrorBoundary
---

# `ErrorBoundary`

<docs-warning>The separation of `CatchBoundary` and `ErrorBoundary` has been deprecated and Remix v2 will use a singular `ErrorBoundary` for all thrown Responses and Errors. It is recommended that you opt-into the new behavior in Remix v1 via the `future.v2_errorBoundary` flag in your `remix.config.js` file. Please refer to the [ErrorBoundary (v2)][error-boundary-v2] docs for more information.</docs-warning>

An `ErrorBoundary` is a React component that renders whenever there is an error anywhere on the route, either during rendering or during data loading.

**Note:** We use the word "error" to mean an uncaught exception; something you didn't anticipate happening. This is different from other types of "errors" that you are able to recover from easily, for example a 404 error where you can still show something in the user interface to indicate you weren't able to find some data.

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
