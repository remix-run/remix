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

<docs-warning>The `useNavigation().formMethod` field is lowercase without the `future.v2_normalizeFormMethod` [Future Flag][api-development-strategy]. This is being normalized to uppercase to align with the `fetch()` behavior in v2, so please upgrade your Remix v1 applications to adopt the uppercase HTTP methods.</docs-warning>

<docs-info>For more information and usage, please refer to the [React Router `useNavigation` docs][rr-usenavigation].</docs-info>

[rr-usenavigation]: https://reactrouter.com/hooks/use-navigation
[api-development-strategy]: ../pages/api-development-strategy
