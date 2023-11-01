---
title: useFetchers
toc: false
---

# `useFetchers`

Returns an array of all in-flight fetchers. This is useful for components throughout the app that didn't create the fetchers but want to use their submissions to participate in optimistic UI.

```tsx
import { useFetchers } from "@remix-run/react";

function SomeComponent() {
  const fetchers = useFetchers();
  fetchers[0].formData; // FormData
  fetchers[0].state; // etc.
  // ...
}
```

The fetchers don't contain [`fetcher.Form`][fetcher_form], [`fetcher.submit`][fetcher_submit], or [`fetcher.load`][fetcher_load], only the states like [`fetcher.formData`][fetcher_form_data], [`fetcher.state`][fetcher_state], etc.

## Additional Resources

**Discussions**

- [Form vs. Fetcher][form_vs_fetcher]
- [Pending, Optimistic UI][pending_optimistic_ui]

**API**

- [`useFetcher`][use_fetcher]
- [`v3_fetcherPersist`][fetcherpersist]

[fetcher_form]: ./use-fetcher#fetcherform
[fetcher_submit]: ./use-fetcher#fetchersubmitformdata-options
[fetcher_load]: ./use-fetcher#fetcherloadhref
[fetcher_form_data]: ./use-fetcher#fetcherformdata
[fetcher_state]: ./use-fetcher#fetcherstate
[form_vs_fetcher]: ../discussion/form-vs-fetcher
[pending_optimistic_ui]: ../discussion/pending-ui
[use_fetcher]: ./use-fetcher
[fetcherpersist]: ../file-conventions/remix-config#future
