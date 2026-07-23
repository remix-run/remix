# SPA

`SPA` renders same-origin browser navigations through a router that maps URLs to Remix UI nodes.

```tsx
import { createRouter } from 'remix/router'
import { createRoot, type RemixNode } from 'remix/ui'
import { SPA } from 'remix/ui/spa'

declare module 'remix/router' {
  interface RouterTypes {
    output: RemixNode
  }
}

let router = createRouter({ defaultHandler: () => null })
router.get('/', () => <h1>Home</h1>)

let root = createRoot(document.body)
root.render(<SPA router={router} fallback="Loading…" />)
```

`SPA` intercepts same-origin browser navigations, exposes the active and pending URLs through its component context, and forwards navigation cancellation to `router.fetch(url, { signal })`. It also forwards intercepted form submissions as `POST` requests with their `FormData`.

Navigation history entries do not retain submitted `FormData`, so back and forward navigations revisit form destinations with GET requests. Form destinations should therefore accept both GET and POST.
