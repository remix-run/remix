---
title: useRevalidator
new: true
---

# `useRevalidator`

Revalidate the data on the page for reasons outside of normal data mutations like window focus or polling on an interval.

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

Remix already revalidates the data on the page automatically when actions are called. If you find yourself using this for normal CRUD operations on your data in response to user interactions, you're probably not taking advantage of the other APIs like [`<Form>`][form-component], [`useSubmit`][use-submit], or [`useFetcher`][use-fetcher] that do this automatically.

## Properties

### `revalidator.state`

The state the revalidation. Either `"idle"` or `"loading"`.

### `revalidator.revalidate()`

Initiates a revalidation.

```tsx
function useLivePageData() {
  const revalidator = useRevalidator();
  const interval = useInterval(5000);

  useEffect(() => {
    if (revalidator.state === "idle") {
      revalidator.revalidate();
    }
  }, [interval, revalidator]);
}
```

## Notes

While you can render multiple occurrences of `useRevalidator` at the same time, underneath it is a singleton. This means when one `revalidator.revalidate()` is called, all instances go into the `"loading"` state together (or rather, they all update to report the singleton state).

Race conditions are automatically handled when calling `revalidate()` when a revalidation is already in progress for any other reason.

If a navigation happens while a revalidation is in flight, the revalidation will be cancelled and fresh data will be requested from all loaders for the next page.

[form-component]: ../components/form
[use-fetcher]: ./use-fetcher
[use-submit]: ./use-submit
