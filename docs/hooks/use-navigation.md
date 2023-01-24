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
  navigation.state;
  navigation.location;
  navigation.formData;
  navigation.formAction;
  navigation.formMethod;
}
```

For more information and usage, please refer to the [React Router `useNavigation` docs][rr-usenavigation].

[rr-usenavigation]: https://reactrouter.com/hooks/use-navigation
