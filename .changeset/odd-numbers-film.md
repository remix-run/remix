---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Add `future.v2_errorBoundary` flag to opt-into v2 `ErrorBoundary` behavior.  This removes the separate `CatchBoundary` and `ErrorBoundary` and consolidates them into a single `ErrorBoundary` following the logic used by `errorElement` in React Router. You can then use `isRouteErrorResponse` to differentiate between thrown `Response`/`Error` instances.

```jsx
// Current (Remix v1 default)
export function CatchBoundary() {
  let caught = useCatch();
  return <p>{caught.status} {caught.data}</p>;
}

export function ErrorBoundary({ error }) {
  return <p>{error.message}</p>;
}


// Using future.v2_errorBoundary
export function ErrorBoundary() {
  let error = useRouteError();

  return isRouteErrorResponse(error) ?
    <p>{error.status} {error.data}</p> :
    <p>{error.message}</p>;
}
```