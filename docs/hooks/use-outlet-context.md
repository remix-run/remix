---
title: useOutletContext
---

# `useOutletContext`

Convenience API over [React Context][react-context] that returns the context value from the closest parent [`<Outlet context={val} />`][outlet-context] component.

```tsx
import { useOutletContext } from "@remix-run/react";

function Child() {
  const myValue = useOutletContext();
  // ...
}
```

## Additional Resources

- [`<Outlet context>`][outlet-context]

[react-context]: https://react.dev/learn/passing-data-deeply-with-context
[outlet-context]: ../components/outlet#context
