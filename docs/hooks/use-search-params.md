---
title: useSearchParams
---

# `useSearchParams`

Returns a tuple of the current URL's [`searchParams`][search-params] and a function to update them. Setting the search params causes a navigation.

```tsx
import { useSearchParams } from "@remix-run/react";

export function SomeComponent() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ...
}
```

## Signature

<!-- eslint-disable -->

```tsx
const [searchParams, setSearchParams] = useSearchParams();
```

### `searchParams`

The first value returned is a Web [URLSearchParams][url-search-params] object.

### `setSearchParams(params, navigateOptions)`

The second value returned is a function to set new search params and causes a navigation when called. You can pass an optional second argument with [navigate options][navigateoptions] to configure the navigation.

```tsx
<button
  onClick={() => {
    const params = new URLSearchParams();
    params.set("someKey", "someValue");
    setSearchParams(params, {
      preventScrollReset: true,
    });
  }}
/>
```

### `setSearchParams((prevParams) => newParams, navigateOptions)`

The setter function also supports a function for setting new search params.

```tsx
<button
  onClick={() => {
    setSearchParams((prev) => {
      prev.set("someKey", "someValue");
      return prev;
    });
  }}
/>
```

[search-params]: https://developer.mozilla.org/en-US/docs/Web/API/URL/searchParams
[url-search-params]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[navigateoptions]: ./use-navigate#options
