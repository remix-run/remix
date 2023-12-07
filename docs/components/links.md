---
title: Links
toc: false
---

# `<Links />`

The `<Links/>` component renders all of the [`<link>`][link_element] tags created by your route module [`links`][links] export. You should render it inside the [`<head>`][head_element] of your HTML, usually in `app/root.tsx`.

```tsx filename=app/root.tsx lines=[7]
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

[link_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
[head_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head
[links]: ../route/links
