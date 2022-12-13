---
title: ScrollRestoration
---

# `<ScrollRestoration>`

This component will emulate the browser's scroll restoration on location changes. Hopefully you never notice this component at all!

It must be the last element on the page, right before the `<Scripts/>` tag:

```tsx lines=[4,5]
<html>
  <body>
    {/* ... */}
    <ScrollRestoration />
    <Scripts />
  </body>
</html>
```

In order to avoid the typical client-side routing "scroll flash" jank on refresh or clicking back into the app from a different domain, this component restores scroll _before_ React hydration.
