---
title: root
toc: false
---

# Root Route

FIXME: This is mostly the wrong doc, right code.

These components are to be used once inside your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx
import type {
  LinksFunction,
  MetaFunction,
} from "@remix-run/node"; // or cloudflare/deno
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import globalStylesheetUrl from "./global-styles.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: globalStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "My Amazing App",
  viewport: "width=device-width, initial-scale=1",
});

export default function App() {
  return (
    <html lang="en">
      <head>
        {/* All meta exports on all routes will go here */}
        <Meta />

        {/* All link exports on all routes will go here */}
        <Links />
      </head>
      <body>
        {/* Child routes go here */}
        <Outlet />

        {/* Manages scroll position for client-side transitions */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <ScrollRestoration />

        {/* Script tags go here */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <Scripts />

        {/* Sets up automatic reload when you change code */}
        {/* and only does anything during development */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <LiveReload />
      </body>
    </html>
  );
}
```

You can pass extra props to `<Scripts />` like `<Scripts crossOrigin />` for hosting your static assets on a different server than your app.

The example above renders several `<script />` tags into the resulting HTML. While this usually just works, you might have configured a [content security policy for scripts][csp] that prevents these `<script />` tags from being executed. In particular, to support [content security policies with nonce-sources for scripts][csp-nonce], the `<Scripts />`, `<LiveReload />` and `<ScrollRestoration />` components support a `nonce` property, e.g.`<Script nonce={nonce}/>`. The provided nonce is subsequently passed to the `<script />` tag rendered into the HTML by these components, allowing the scripts to be executed in accordance with your CSP policy.

See also:

- [`meta`][meta]
- [`links`][links]

[csp]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
[csp-nonce]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/Sources#sources
[meta]: ../route/meta
[links]: ../route/links
