---
title: useRouteError
new: true
---

# `useRouteError`

Accesses the error thrown during an action, loader, or rendering to be used in an ErrorBoundary.

```jsx filename=routes/some-route.tsx
export function ErrorBoundary() {
  const error = useRouteError();
  return <div>{error.message}</div>;
}
```

## Additional Resources

**Guides**

- [Error Handling Guide][error-handling-guide]

**API Reference**

- [`ErrorBoundary`][error-boundary]

[error-handling-guide]: ../guides/errors
[error-boundary]: ../route/error-boundary
