---
title: useAsyncError
new: true
---

# `useAsyncError`

Returns the rejection value from the closest [`<Await>`][await_component] component.

```tsx lines[4,12]
import { Await, useAsyncError } from "@remix-run/react";

function ErrorElement() {
  const error = useAsyncError();
  return (
    <p>Uh Oh, something went wrong! {error.message}</p>
  );
}

<Await
  resolve={promiseThatRejects}
  errorElement={<ErrorElement />}
/>;
```

## Additional Resources

**Guides**

- [Streaming][streaming_guide]

**API**

- [`<Await/>`][await_component]
- [`useAsyncValue()`][use_async_value]

[await_component]: ../components/await
[streaming_guide]: ../guides/streaming
[use_async_value]: ../hooks/use-async-value
