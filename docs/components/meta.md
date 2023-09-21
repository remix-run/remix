---
title: Meta
toc: false
---

# `<Meta />`

This component renders all of the [`<meta>`][meta_element] tags created by your route module [`meta`][meta] export. You should render it inside the [`<head>`][head_element] of your HTML, usually in `app/root.tsx`.

```tsx filename=app/root.tsx lines=[7]
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

[meta_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
[head_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head
[meta]: ../route/meta
