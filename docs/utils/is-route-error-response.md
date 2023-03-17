---
title: isRouteErrorResponse
toc: false
---

# `isRouteErrorResponse`

<docs-info>This util is simply a re-export of [React Router's `isRouteErrorResponse`][rr-isrouteerrorresponse].</docs-info>

When a response is thrown from an action or loader, it will be unwrapped into an `ErrorResponse` so that your component doesn't have to deal with the complexity of unwrapping it (which would require React state and effects to deal with the promise returned from `res.json()`)

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

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

[rr-isrouteerrorresponse]: https://reactrouter.com/utils/is-route-error-response
