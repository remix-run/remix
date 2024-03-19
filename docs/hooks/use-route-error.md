---
title: useRouteError
new: true
---

# `useRouteError`

Accesses the error thrown during an [`action`][action], [`loader`][loader], or rendering to be used in an [`ErrorBoundary`][error-boundary].

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

[action]: ../route/action
[loader]: ../route/loader
[error-boundary]: ../route/error-boundary
[error-handling-guide]: ../guides/errors
