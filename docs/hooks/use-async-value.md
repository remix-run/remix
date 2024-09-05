---
title: useAsyncValue
new: true
---

# `useAsyncValue`

Returns the resolved data from the closest [`<Await>`][await_component] ancestor component.

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

- [Streaming][streaming_guide]

**API**

- [`<Await/>`][await_component]
- [`useAsyncError`][use_async_error]

[await_component]: ../components/await
[streaming_guide]: ../guides/streaming
[use_async_error]: ../hooks/use-async-error
