---
title: ScrollRestoration
---

# `<ScrollRestoration>`

This component will emulate the browser's scroll restoration on location changes after loaders have completed. This ensures the scroll position is restored to the right spot, at the right time, even across domains.

You should only render one of these, right before the `<Scripts/>` component.

```tsx lines=[2,11]
import {
  ScrollRestoration,
  Scripts,
} from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <body>
        {/* ... */}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

## React Router `<ScrollRestoration/>`

This is a wrapper around [React Router `<ScrollRestoration>`][rr-scrollrestoration]. Because Remix server renders your app's HTML, it can restore scroll positions before JavaScript even loads, avoiding the janky "scroll jump" typically found in SPAs. Other than that, it is identical to the React Router version.

For advanced usage, see the [React Router ScrollRestoration docs][rr-scrollrestoration].

[rr-scrollrestoration]: https://reactrouter.com/en/main/components/scroll-restoration
