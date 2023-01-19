---
title: LiveReload
---

# `<LiveReload />`

This component connects your app to the Remix asset server and automatically reloads the page when files change in development. In production it renders `null`, so you can safely render it always in your root route.

```tsx filename=root.tsx lines=[8]
import { LiveReload } from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <head />
      <body>
        <LiveReload />
      </body>
    </html>
  );
}
```
