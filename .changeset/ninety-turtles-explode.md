---
"@remix-run/dev": patch
---

Vite: Remove interop with `<LiveReload />`, rely on `<Scripts />` instead

**This is a breaking change for projects using the unstable Vite plugin.**

For HMR and HDR to function, the React Fast Refresh preamble has to execute
before any route modules. Having a separate component for dev scripts
— `<LiveReload />` — implicitly relied on browser script execution order.
This opened the door for race conditions that could only be avoided through hacks.

Additionally, Vite comes with its own HMR runtime out-of-the-box, so much of the
setup done within `<LiveReload />` became obsolete.

To fix this, we now rely on `<Scripts />` to programmatically control execution
order between dev preamble and route modules within a single script.

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
