---
"@remix-run/dev": patch
"@remix-run/react": patch
---

Vite: Replace <LiveReload/> with <DevScripts/>

**This is a breaking change for projects using the unstable Vite plugin.**

The `<LiveReload/>` component has a confusing name as it now also supports HMR and HDR.
Additionally, it provides an bespoke client-side runtime that is obsoleted by Vite.
To get our Vite plugin working, we were doing some compiler magic to swap out the
implementation of `<LiveReload/>`.
This was always meant as a temporary measure.

Now we have a better solution in the form of a new `<DevScripts/>` component specifically
designed with Vite's HMR capabilities in mind.

The `<LiveReload />` component will cease to provide HMR and HDR capabilities in Vite,
so you'll need to replace `<LiveReload/>` with `<DevScripts/>` in your app.

The `<DevScripts/>` component should be placed in the `<head/>` of your app so that it
can be loaded before any other scripts as required by React Fast Refresh.

```diff
  import {
-   LiveReload,
+   DevScripts,
    Outlet,
  }

  export default function App() {
    return (
      <html>
        <head>
+         <DevScripts />
        </head>
        <body>
-         <LiveReload />
          <Outlet />
        </body>
      </html>
    )
  }
```
