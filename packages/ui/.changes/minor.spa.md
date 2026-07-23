Export an `SPA` component from `remix/ui/spa` that renders same-origin browser navigations through a URL-to-`RemixNode` router, exposes active and pending URLs through component context, forwards cancellation signals, and dispatches intercepted form submissions with their `FormData`.

```tsx
import { createRouter } from 'remix/router'
import { createRoot, type RemixNode } from 'remix/ui'
import { SPA } from 'remix/ui/spa'

declare module 'remix/router' {
  interface RouterTypes {
    output: RemixNode
  }
}

let router = createRouter({ defaultHandler: () => <h1>Not Found</h1> })
router.get('/', () => <h1>Home</h1>)

let root = createRoot(document.getElementById('app')!)
root.render(<SPA router={router} fallback={<p>Loading...</p>} />)
```
