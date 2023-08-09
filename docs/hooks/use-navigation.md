---
title: useNavigation
toc: false
---

# `useNavigation`

<docs-info>This hook is simply a re-export of [React Router `useNavigation`][rr-usenavigation].</docs-info>

```tsx
import { useNavigation } from "@remix-run/react";

function SomeComponent() {
  const navigation = useNavigation();
  navigation.state; // "idle" | "submitting" | "loading"
  navigation.location; // Location being navigated to
  navigation.formData; // formData being submitted
  navigation.formAction; // url being submitted to
  navigation.formMethod; // "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
}
```

<docs-info>For more information and usage, please refer to the [React Router `useNavigation` docs][rr-usenavigation].</docs-info>

[rr-usenavigation]: https://reactrouter.com/hooks/use-navigation
[api-development-strategy]: ../pages/api-development-strategy
