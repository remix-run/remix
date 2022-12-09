---
title: Meta
---

# `<Meta />`

This component renders all of the `<meta>` tags created by your route module [`meta`][meta] export. You should render it inside the `<head>` of your HTML, usually in `app/root.tsx`.

```tsx filename=root.tsx lines=[7]
import { Meta } from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <head>
        <Meta />
      </head>
      <body></body>
    </html>
  );
}
```

[meta]: ../route/meta
