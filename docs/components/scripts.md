---
title: Scripts
toc: false
---

# `<Scripts />`

This component renders the client runtime of your app. You should render it inside the [`<body>`][body-element] of your HTML, usually in [`app/root.tsx`][root].

```tsx filename=app/root.tsx lines=[8]
import { Scripts } from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <head />
      <body>
        <Scripts />
      </body>
    </html>
  );
}
```

If you don't render the `<Scripts/>` component, your app will still work like a traditional web app without JavaScript, relying solely on HTML and browser behaviors.

## Props

The `<Scripts>` component can pass through certain attributes to the underlying `<script>` tags such as:

- `<Scripts crossOrigin>` for hosting your static assets on a different server than your app.
- `<Scripts nonce>` to support a [content security policy for scripts][csp] with [nonce-sources][csp-nonce] for your `<script>` tags.

You cannot pass through attributes such as `async`/`defer`/`src`/`type`/`noModule` because they are managed by Remix internally.

[body-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/body
[csp]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
[csp-nonce]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/Sources#sources
[root]: ../file-conventions/root
