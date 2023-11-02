---
title: useNavigate
---

# `useNavigate`

The `useNavigate` hook returns a function that lets you navigate programmatically in the browser in response to user interactions or effects.

```tsx
import { useNavigate } from "@remix-run/react";

function SomeComponent() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        navigate(-1);
      }}
    />
  );
}
```

It's often better to use [`redirect`][redirect] in loaders and actions than this hook, but it still has use cases.

## Arguments

### `to: string`

The most basic usage takes an href string:

```tsx
navigate("/some/path");
```

Paths can be relative:

```tsx
navigate("..");
navigate("../other/path");
```

### `to: To`

You can also pass a `To` value:

```tsx
navigate({
  pathname: "/some/path",
  search: "?query=string",
  hash: "#hash",
});
```

### `to: Number`

Passing a number will tell the browser to go back or forward in the history stack:

```tsx
navigate(-1); // go back
navigate(1); // go forward
navigate(-2); // go back two
```

Note that this may send you out of your application since the history stack of the browser isn't scoped to just your application.

### `options`

The second argument is an options object:

```tsx
navigate(".", {
  replace: true,
  relative: "path",
  state: { some: "state" },
});
```

- **replace**: boolean - replace the current entry in the history stack instead of pushing a new one
- **relative**: `"route" | "path"` - defines the relative path behavior for the link. `"route"` will use the route hierarchy so `".."` will remove all URL segments of the current route pattern while `"path"` will use the URL path so `".."` will remove one URL segment.
- **state**: any - adds persistent client side routing state to the next location.

[redirect]: ../fetch/redirect
