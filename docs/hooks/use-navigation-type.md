---
title: useNavigationType
---

# `useNavigationType`

Returns the type of navigation used when the user arrived at the current location.

```tsx
import { useNavigationType } from "@remix-run/react";

function SomeComponent() {
  const navigationType = useNavigationType();
  // ...
}
```

## Return Values

- **PUSH**: The user came to the current page via a push action on the history stack: clicking a link or submitting a form, etc.
- **REPLACE**: The user came to the current page via a `replace` action on the history stack: clicking a link with `<Link replace>`, submitting a form with `<Form replace>` or calling `navigate(to, { replace: true })`, etc.
- **POP**: The user came to the current page via a pop action on the history stack: clicking the back or forward button, calling `navigate(-1)` or `navigate(1)`, etc.

## Additional Resources

- [`<Link replace>`][link-replace]
- [`<Form replace>`][form-replace]
- [`navigate` options][navigate-options]

[link-replace]: ../components/link#replace
[form-replace]: ../components/form#replace
[navigate-options]: ../hooks/use-navigate#options
