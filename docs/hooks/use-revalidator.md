---
title: useRevalidator
---

# `useRevalidator`

This hook allows you to revalidate the data for any reason. React Router automatically revalidates the data after actions are called, but you may want to revalidate for other reasons like when focus returns to the window.

```jsx
import { useRevalidator } from "@remix-run/react";

function WindowFocusRevalidator() {
  let revalidator = useRevalidator();

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

For more information see the [React Router `useRevalidator` docs][rr-userevalidator]

[rr-userevalidator]: https://reactrouter.com/en/main/hooks/use-revalidator
