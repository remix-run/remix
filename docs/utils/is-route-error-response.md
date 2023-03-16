---
title: isRouteErrorResponse
---

# `isRouteErrorResponse`

<docs-info>This is just a re-export of the React Router [`isRouteErrorResponse`][rr-is-route-error-response] utility.</docs-info>

When a response is thrown from an action or loader, it will be unwrapped into an `ErrorResponse` so that your component doesn't have to deal with the complexity of unwrapping it (which would require React state and effects to deal with the promise returned from `res.json()`)

```jsx
import { json } from "@remix-run/node";

export function action() {
  throw json(
    { message: "email is required" },
    { status: 400, statusText: "Bad Request" }
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    error.status; // 400
    error.statusText; // Bad Request
    error.data; // { "message: "email is required" }
  }
}
```

<docs-info>If the user visits a route that does not match any routes in the app, Remix itself will throw a 404 response.</docs-info>

[rr-is-route-error-response]: https://reactrouter.com/en/main/utils/is-route-error-response
