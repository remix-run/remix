---
title: Outlet
---

# `<Outlet>`

Renders the matching child route of a parent route.

```tsx
import { Outlet } from "@remix-run/react";

export default function SomeParent() {
  return (
    <div>
      <h1>Parent Content</h1>

      <Outlet />
    </div>
  );
}
```

## Props

### `context`

Provides a context value to the element tree below the outlet. Use when the parent route needs to provide values to child routes.

```tsx
<Outlet context={myContextValue} />
```

See also: [`useOutletContext`][use-outlet-context]

[use-outlet-context]: ../hooks/use-outlet-context
