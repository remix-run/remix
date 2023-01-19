---
title: Await
---

# `<Await>`

The `<Await>` component is responsible for resolving promises accessed from [`useLoaderData`][useloaderdata]. This can be thought of as a thin wrapper around React Error Boundaries with support for handling SSR that will suspend to resolve the data of a deferred loader value.

`<Await>` can be used to resolve the deferred value in one of two ways:

Directly as a render function:

```tsx
<Suspense>
  <Await resolve={deferredValue}>
    {(data) => <p>{data}</p>}
  </Await>
</Suspense>
```

Or indirectly via the `useAsyncValue` hook:

```tsx
function Accessor() {
  const value = useAsyncValue();
  return <p>{value}</p>;
}
// ...
<Suspense>
  <Await resolve={deferredValue}>
    <Accessor />
  </Await>
</Suspense>;
```

`<Await>` is paired with [`defer()`][defer] in your loader. Returning a deferred value from your loader will put Remix in streaming mode and allow you to render fallbacks with `<Suspense>`. A full example can be found in the [streaming guide][streaming-guide].

[defer]: ../utils/defer
[streaming-guide]: ../guides/streaming
[useloaderdata]: ../hooks/use-loader-data
