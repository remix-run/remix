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

## Options

### `key`

By default, `useFetcher` generates a unique fetcher scoped to that component (however, it may be looked up in [`useFetchers()`][use_fetchers] while in-flight). If you want to identify a fetcher with your own key such that you can access it from elsewhere in your app, you can do that with the `key` option:

```tsx lines=[2,8]
function AddToBagButton() {
  const fetcher = useFetcher({ key: "add-to-bag" });
  return <fetcher.Form method="post">...</fetcher.Form>;
}

// Then, up in the header...
function CartCount({ count }) {
  const fetcher = useFetcher({ key: "add-to-bag" });
  const inFlightCount = Number(
    fetcher.formData?.get("quantity") || 0
  );
  const optimisticCount = count + inFlightCount;
  return (
    <>
      <BagIcon />
      <span>{optimisticCount}</span>
    </>
  );
}
```

## Components

### `fetcher.Form`

Just like [`<Form>`][form_component] except it doesn't cause a navigation.

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

- [`FormData`][form_data] - A `FormData` instance.
- [`HTMLFormElement`][html_form_element] - A [`<form>`][form_element] DOM element.
- `Object` - An object of key/value pairs that will be converted to a `FormData` instance by default. You can pass a more complex object and serialize it as JSON by specifying `encType: "application/json"`. See [`useSubmit`][use-submit] for more details.

If the method is `GET`, then the route [`loader`][loader] is being called and with the `formData` serialized to the url as [`URLSearchParams`][url_search_params]. If `DELETE`, `PATCH`, `POST`, or `PUT`, then the route [`action`][action] is being called with `formData` as the body.

```tsx
// Submit a FormData instance (GET request)
const formData = new FormData();
fetcher.submit(formData);

// Submit the HTML form element
fetcher.submit(event.currentTarget.form, {
  method: "POST",
});

// Submit key/value JSON as a FormData instance
fetcher.submit(
  { serialized: "values" },
  { method: "POST" }
);

// Submit raw JSON
fetcher.submit(
  {
    deeply: {
      nested: {
        json: "values",
      },
    },
  },
  {
    method: "POST",
    encType: "application/json",
  }
);
```

`fetcher.submit` is a wrapper around a [`useSubmit`][use-submit] call for the fetcher instance, so it also accepts the same options as `useSubmit`.

### `fetcher.load(href, options)`

Loads data from a route loader. While multiple nested routes can match a URL, only the leaf route will be called.

```ts
fetcher.load("/some/route");
fetcher.load("/some/route?foo=bar");
```

`fetcher.load`'s revalidate by default after action submissions and explicit revalidation requests via [`useRevalidator`][userevalidator]. Because `fetcher.load` loads a specific URL they don't revalidate on changes to route param or URL search param. You can use [`shouldRevalidate`][shouldrevalidate] to optimize which data should be reloaded.

#### `options.flushSync`

The `flushSync` option tells React Router DOM to wrap the initial state update for this `fetcher.load` in a [`ReactDOM.flushSync`][flush-sync] call instead of the default [`React.startTransition`][start-transition]. This allows you to perform synchronous DOM actions immediately after the update is flushed to the DOM.

<docs-warning>`ReactDOM.flushSync` de-optimizes React and can hurt the performance of your app.</docs-warning>

## Properties

### `fetcher.state`

You can know the state of the fetcher with `fetcher.state`. It will be one of:

- **idle** - Nothing is being fetched.
- **submitting** - A form has been submitted. If the method is `GET`, then the route `loader` is being called. If `DELETE`, `PATCH`, `POST`, or `PUT`, then the route `action` is being called.
- **loading** - The loaders for the routes are being reloaded after an `action` submission.

### `fetcher.data`

The returned response data from your `action` or `loader` is stored here. Once the data is set, it persists on the fetcher even through reloads and resubmissions (like calling `fetcher.load()` again after having already read the data).

### `fetcher.formData`

The `FormData` instance that was submitted to the server is stored here. This is useful for optimistic UIs.

### `fetcher.formAction`

The URL of the submission.

### `fetcher.formMethod`

The form method of the submission.

## Additional Resources

**Discussions**

- [Form vs. Fetcher][form_vs_fetcher]
- [Network Concurrency Management][network_concurrency_management]

**Videos**

- [Concurrent Mutations w/ useFetcher][concurrent_mutations_with_use_fetcher]
- [Optimistic UI][optimistic_ui]

[form_component]: ../components/form
[form_data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[html_form_element]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement
[form_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form
[loader]: ../route/loader
[url_search_params]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[action]: ../route/action
[form_vs_fetcher]: ../discussion/form-vs-fetcher
[network_concurrency_management]: ../discussion/concurrency
[concurrent_mutations_with_use_fetcher]: https://www.youtube.com/watch?v=vTzNpiOk668&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[optimistic_ui]: https://www.youtube.com/watch?v=EdB_nj01C80&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[use_fetchers]: ./use-fetchers
[flush-sync]: https://react.dev/reference/react-dom/flushSync
[start-transition]: https://react.dev/reference/react/startTransition
[use-submit]: ./use-submit
[userevalidator]: ./use-revalidator
[shouldrevalidate]: ../route/should-revalidate#shouldrevalidate
