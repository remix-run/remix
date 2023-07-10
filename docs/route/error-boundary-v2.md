---
title: ErrorBoundary (v2)
new: true
---

# `ErrorBoundary (v2)`

You can opt-in to the new ErrorBoundary API with a future flag in Remix config.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  future: {
    v2_errorBoundary: true,
  },
};
```

A Remix `ErrorBoundary` component works just like normal React [error boundaries][error-boundaries], but with a few extra capabilities. When there is an error in your route component, the `ErrorBoundary` will be rendered in its place, nested inside any parent routes. `ErrorBoundary` components also render when there is an error in the `loader` or `action` functions for a route, so all errors for that route may be handled in one spot.

The most common use-cases tend to be:

- You may intentionally throw a 4xx `Response` to trigger an error UI
  - Throwing a 400 on bad user input
  - Throwing a 401 for unauthorized access
  - Throwing a 404 when you can't find requested data
- React may unintentionally throw an `Error` if it encounters a runtime error during rendering

To obtain the thrown object, you can use the [`useRouteError`][use-route-error] hook. When a `Response` is thrown, it will be automatically unwrapped into an `ErrorResponse` instance with `state`/`statusText`/`data` fields so that you don't need to bother with `await response.json()` in your component. To differentiate thrown `Response`'s from thrown `Error`'s' you can use the [`isRouteErrorResponse`][is-route-error-response] utility.

```tsx
import {
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
```

[error-boundaries]: https://reactjs.org/docs/error-boundaries.html
[rr-error-boundary]: https://reactrouter.com/en/main/route/error-element
[use-route-error]: ../hooks/use-route-error
[is-route-error-response]: ../utils/is-route-error-response
