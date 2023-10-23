---
title: useSearchParams
---

# `useSearchParams`

Returns a tuple of the current [search params][searchparams] and a function to update them. Setting the search params causes a navigation.

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

The first value returned is a [Web URLSearchParams][searchparams] object.

### `setSearchParams(params)`

The second value returned is a function to set new search params and causes a navigation when called.

```tsx
<button
  onClick={() => {
    const params = new URLSearchParams();
    params.set("someKey", "someValue");
    setSearchParams(params);
  }}
/>
```

### `setSearchParams((prevParams) => newParams)`

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

[searchparams]: https://developer.mozilla.org/en-US/docs/Web/API/URL/searchParams
[usesearchparams-native]: ./use-search-params-rn
[usestate]: https://react.dev/reference/react/useState
[usenavigate]: ./use-navigate
