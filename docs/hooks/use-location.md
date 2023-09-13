---
title: useLocation
toc: false
---

# `useLocation`

Returns the current location object.

```tsx
import { useLocation } from "@remix-run/react";

function SomeComponent() {
  const location = useLocation();
  // ...
}
```

## Properties

### `location.hash`

The hash of the current URL.

### `location.key`

The unique key of this location.

### `location.pathname`

The path of the current URL.

### `location.search`

The query string of the current URL.

### `location.state`

The state value of the location created by [`<Link state>`][link-state] or [`navigate`][navigate].

[link-state]: ../components/link
[navigate]: ./use-navigate
