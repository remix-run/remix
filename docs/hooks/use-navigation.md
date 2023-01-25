---
title: useNavigation
toc: false
---

# `useNavigation`

This hook is simply a re-export of [React Router `useNavigation`][rr-usenavigation].

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

For information and usage, please refer to the [React Router `useNavigation` docs][rr-usenavigation].

[rr-usenavigation]: https://reactrouter.com/en/main/hooks/use-navigation
