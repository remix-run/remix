---
title: LiveReload
toc: false
---

# `<LiveReload />`

This component connects your app to the Remix asset server and automatically reloads the page when files change in development. In production, it renders `null`, so you can safely render it always in your root route.

```tsx filename=app/root.tsx lines=[8]
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

## Props

### `origin`

Specify a custom origin for the Live Reload protocol. The url provided should use the `http` protocol, that will be upgraded to `ws` protocol internally. This is useful when using a reverse proxy in front of the Remix dev server. The default value is the `REMIX_DEV_ORIGIN` environment variable, or `window.location.origin` only if `REMIX_DEV_ORIGIN` is not set.

### `port`

Specify a custom port for the Live Reload protocol. The default value is the port derived from `REMIX_DEV_ORIGIN` environment variable, or `8002` only if `REMIX_DEV_ORIGIN` is not set.

### `timeoutMs`

The `timeoutMs` prop allows specifying a custom timeout for the Live Reload protocol, in milliseconds. This is the delay before trying to reconnect if the Web Socket connection is lost. The default value is `1000`.
