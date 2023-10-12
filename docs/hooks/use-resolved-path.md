---
title: useResolvedPath
---

# `useResolvedPath`

Resolves the `pathname` of the given `to` value against the pathname of the current location and returns a `Path` object.

```tsx
import { useResolvedPath } from "@remix-run/react";

function SomeComponent() {
  const path = useResolvedPath("../some/where");
  path.pathname;
  path.search;
  path.hash;
  // ...
}
```

This is useful when building links from relative values and used internally for [`<NavLink>`][navlink].

## Additional Resources

- [`resolvePath`][resolvepath]

[navlink]: ../components/nav-link
[resolvepath]: ../utils/resolve-path
