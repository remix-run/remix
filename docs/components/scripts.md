---
title: Scripts
toc: false
---

# `<Scripts />`

This component renders the client runtime of your app. You should render it inside the [`<body>`][body-element] of your HTML, usually in `app/root.tsx`.

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

[body-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/body
