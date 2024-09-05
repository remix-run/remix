---
title: useMatches
toc: false
---

# `useMatches`

Returns the current route matches on the page. This is useful for creating layout abstractions with your current routes.

```tsx
function SomeComponent() {
  const matches = useMatches();

  // ...
}
```

`matches` has the following shape:

```ts
[
  { id, pathname, data, params, handle }, // root route
  { id, pathname, data, params, handle }, // layout route
  { id, pathname, data, params, handle }, // child route
  // etc.
];
```

## Additional Resources

- [Breadcrumbs Guide][breadcrumbs-guide]

[breadcrumbs-guide]: ../guides/breadcrumbs
