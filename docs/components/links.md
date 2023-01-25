---
title: Links
toc: false
---

# `<Links />`

The `<Links/>` component renders all of the `<link>` tags created by your route module [`links`][links] export. You should render it inside the `<head>` of your HTML, usually in `app/root.tsx`.

```tsx filename=root.tsx lines=[7]
import { Links } from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <head>
        <Links />
      </head>
      <body></body>
    </html>
  );
}
```

[links]: ../route/links
