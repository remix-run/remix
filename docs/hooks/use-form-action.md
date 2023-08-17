---
title: useFormAction
---

# `useFormAction`

Resolves the URL to the closest route in the component hierarchy instead of the current URL of the app.

This is used internally by [`<Form>`][form_component] to resolve the action to the closest route, but can be used generically as well.

```tsx
import { useFormAction } from "@remix-run/react";

function SomeComponent() {
  // closest route URL
  const action = useFormAction();

  // closest route URL + "destroy"
  const destroyAction = useFormAction("destroy");
}
```

## Signature

```
useFormAction(action, options)
```

### `action`

Optional. The action to append to the closest route URL.

### `options`

The only option is `{ relative: "route" | "path"}`.

- **route** default - relative to the route hierarchy, not the URL
- **path** - makes the action relative to the URL paths, so `..` will remove one URL segment.

[form_component]: ../components/form
