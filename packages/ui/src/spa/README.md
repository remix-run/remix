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

`SPA` intercepts same-origin browser navigations, exposes the active and pending URLs through its component context, and forwards navigation cancellation to `router.fetch(url, { signal })`. It preserves the native method for intercepted form submissions and forwards `FormData` as the body of non-GET requests.

Add `rmx-document` to a link or form to bypass SPA interception. Use `rmx-history="push|replace"` to override whether the navigation pushes or replaces the current history entry.

Use `createSPA` in the setup scope of a custom top-level component when it needs to compose the rendered node or navigation state:

```tsx
import type { Handle } from 'remix/ui'
import { createSPA } from 'remix/ui/spa'

function App(handle: Handle) {
  let spa = createSPA(handle, { router, fallback: 'Loading…' })

  return () => <main data-loading={spa.context.pending != null ? '' : undefined}>{spa.node}</main>
}
```

Navigation history entries do not retain submitted `FormData`, so back and forward navigations revisit form destinations with GET requests. Form destinations that handle non-GET submissions should therefore also accept GET.
