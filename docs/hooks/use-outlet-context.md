---
title: useOutletContext
---

# `useOutletContext`

Convenience API over React Context that returns the context value from the closest parent `<Outlet context={val} />` component.

```tsx
import { useOutletContext } from "@remix-run/react";

function Child() {
  const myValue = useOutletContext();
  // ...
}
```

## Additional Resources

- [`<Outlet context>`][outlet-context]

[outlet-context]: ../components/outlet#context
