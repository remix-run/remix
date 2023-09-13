---
title: useFetchers
toc: false
---

# `useFetchers`

Returns an array of all inflight fetchers. This is useful for components throughout the app that didn't create the fetchers but want to use their submissions to participate in optimistic UI.

```tsx
import { useFetchers } from "@remix-run/react";

function SomeComponent() {
  const fetchers = useFetchers();
  fetchers[0].formData; // FormData
  fetchers[0].state; // etc.
  // ...
}
```

The fetchers don't contain `fetcher.Form`, `fetcher.submit`, or `fetcher.load`, only the states like `fetcher.formData`, `fetcher.state`, etc.

## Additional Resources

**Discussions**

- [Form vs. Fetcher][form-vs-fetcher]
- [Pending, Optimistic UI][pending-optimistic-ui]

**API**

- [`useFetcher`][use-fetcher]

[form-vs-fetcher]: ../discussion/form-vs-fetcher
[pending-optimistic-ui]: ../discussion/pending-ui
[use-fetcher]: ./use-fetcher
