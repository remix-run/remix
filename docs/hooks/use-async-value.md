---
title: useAsyncValue
new: true
---

# `useAsyncValue`

Returns the resolved data from the closest `<Await>` ancestor component.

```tsx
function SomeDescendant() {
  const value = useAsyncValue();
  // ...
}
```

```tsx
<Await resolve={somePromise}>
  <SomeDescendant />
</Await>
```

## Additional Resources

**Guides**

- [Streaming][streaming]

**API**

- [`<Await/>`][await]
- [`useAsyncError`][use_async_error]

[await]: ../components/await
[use_async_error]: ../hooks/use-async-error
[streaming]: ../guides/streaming
