---
title: useAsyncError
new: true
---

# `useAsyncError`

Returns the rejection value from the closest [`<Await>`][await] component.

```tsx [4,12]
import { useAsyncError, Await } from "react-router-dom";

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

- [Streaming][streaming]

**API**

- [`<Await/>`][await]
- [`useAsyncValue()`][use_async_value]

[await]: ../components/await
[use_async_value]: ../hooks/use-async-value
[streaming]: ../guides/streaming
