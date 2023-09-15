---
title: useFetcher
---

# `useFetcher`

A hook for interacting with the server outside of navigation.

```tsx
import { useFetcher } from "@remix-run/react";

export function SomeComponent() {
  const fetcher = useFetcher();
  // ...
}
```

## Components

### `fetcher.Form`

Just like `<Form>` except it doesn't cause a navigation.

```tsx
function SomeComponent() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" action="/some/route">
      <input type="text" />
    </fetcher.Form>
  );
}
```

## Methods

### `fetcher.submit(formData, options)`

Submits form data to a route. While multiple nested routes can match a URL, only the leaf route will be called.

The `formData` can be multiple types:

- `FormData` - A `FormData` instance.
- `HTMLFormElement` - A `<form>` DOM element.
- `Object` - An object of key/value pairs that will be converted to a `FormData` instance.

If the method is GET, then the route loader is being called and with the formData serialized to the url as URLSearchParams. If POST, PUT, PATCH, or DELETE, then the route action is being called with FormData as the body.

```tsx
fetcher.submit(event.currentTarget.form, {
  method: "POST",
});

fetcher.submit(
  { serialized: "values" },
  { method: "POST" }
);

fetcher.submit(formData);
```

## `fetcher.load(href)`

Loads data from a route loader. While multiple nested routes can match a URL, only the leaf route will be called.

```ts
fetcher.load("/some/route");
fetcher.load("/some/route?foo=bar");
```

## Properties

### `fetcher.state`

You can know the state of the fetcher with `fetcher.state`. It will be one of:

- **idle** - Nothing is being fetched.
- **submitting** - A form has been submitted. If the method is GET, then the route loader is being called. If POST, PUT, PATCH, or DELETE, then the route action is being called.
- **loading** - The loaders for the routes are being reloaded after an action submission.

### `fetcher.data`

The returned response data from your loader or action is stored here. Once the data is set, it persists on the fetcher even through reloads and resubmissions (like calling `fetcher.load()` again after having already read the data).

### `fetcher.formData`

The `FormData` instance that was submitted to the server is stored here. This is useful for optimistic UIs.

### `fetcher.formAction`

The URL of the submission.

### `fetcher.formMethod`

The form method of the submission.

## Additional Resources

**Discussions**

- [Form vs. Fetcher][form-vs-fetcher]
- [Network Concurrency Management][network-concurrency-management]

**Videos**

- [Concurrent Mutations w/ useFetcher][concurrent-mutations-w-use-fetcher]
- [Optimistic UI][optimistic-ui]

[form-vs-fetcher]: ../discussion/form-vs-fetcher
[network-concurrency-management]: ../discussion/concurrency
[concurrent-mutations-w-use-fetcher]: https://www.youtube.com/watch?v=vTzNpiOk668&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[optimistic-ui]: https://www.youtube.com/watch?v=EdB_nj01C80&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
