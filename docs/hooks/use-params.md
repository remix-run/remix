---
title: useParams
---

# `useParams`

Returns an object of key/value pairs of the dynamic params from the current URL that were matched by the routes. Child routes inherit all params from their parent routes.

```tsx
import { useParams } from "@remix-run/react";

function SomeComponent() {
  const params = useParams();
  // ...
}
```

Assuming a route like `routes/posts/$postId.tsx` is matched by `/posts/123` then `params.postId` will be `"123"`.
