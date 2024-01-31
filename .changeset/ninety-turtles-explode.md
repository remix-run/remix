---
"@remix-run/dev": patch
---

Vite: Remove interop with `<LiveReload />`, rely on `<Scripts />` instead

**This is a breaking change for projects using the unstable Vite plugin.**

Vite provides a robust client-side runtime for development features like HMR,
making the `<LiveReload />` component obsolete.

In fact, having a separate dev scripts component was causing issues with script execution order.
To work around this, the Remix Vite plugin used to override `<LiveReload />` into a bespoke
implementation that was compatible with Vite.

Instead of all this indirection, now the Remix Vite plugin instructs the `<Scripts />` component
to automatically include Vite's client-side runtime and other dev-only scripts.

```diff
  import {
-   LiveReload,
    Outlet,
    Scripts,
  }

  export default function App() {
    return (
      <html>
        <head>
        </head>
        <body>
          <Outlet />
          <Scripts />
-         <LiveReload />
        </body>
      </html>
    )
  }
```
