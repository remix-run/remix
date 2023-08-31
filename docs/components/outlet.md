---
title: Outlet
toc: false
---

# `<Outlet>`

Renders the matching child route of a parent route.

```tsx
import { Outlet } from "@remix-run/react";

export function SomeParent() {
  return (
    <div>
      <h1>Parent Content</h1>

      <Outlet />
    </div>
  );
}
```
