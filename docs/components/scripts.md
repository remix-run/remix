---
title: Scripts
toc: false
---

# `<Scripts />`

This component renders the client runtime of your app. You should render it inside the `<body>` of your HTML, usually in `app/root.tsx`.

```tsx filename=root.tsx lines=[8]
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

If you don't render the `<Scripts/>` component, your app will still work like a traditional web app without JavaScript, relying solely on HTML and browser behaviors. That's cool, but we personally have bigger goals than spinning favicons, so we recommend adding JavaScript to your app 😎

[meta]: ../route/meta
