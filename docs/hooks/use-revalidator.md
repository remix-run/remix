---
title: useRevalidator
toc: false
---

# `useRevalidator`

<docs-info>This hook is simply a re-export of [React Router's `useRevalidator`][rr-userevalidator].</docs-info>

This hook allows you to revalidate the data for any reason. React Router automatically revalidates the data after actions are called, but you may want to revalidate for other reasons like when focus returns to the window.

```tsx
import { useRevalidator } from "@remix-run/react";

function WindowFocusRevalidator() {
  const revalidator = useRevalidator();

  useFakeWindowFocus(() => {
    revalidator.revalidate();
  });

  return (
    <div hidden={revalidator.state === "idle"}>
      Revalidating...
    </div>
  );
}
```

<docs-info>For more information and usage, please refer to the [React Router `useRevalidator` docs][rr-userevalidator].</docs-info>

[rr-userevalidator]: https://reactrouter.com/hooks/use-revalidator
