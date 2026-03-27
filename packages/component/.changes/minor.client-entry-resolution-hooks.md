`renderToStream()` now accepts a `resolveClientEntry(entryId, component)` callback for resolving opaque client entry IDs during server rendering.

For example:

```ts
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'

import { resolveEntryId } from './resolve-entry-id.ts'

export function render(node: RemixNode) {
  return renderToStream(node, {
    async resolveClientEntry(entryId, component) {
      return {
        href: await resolveEntryId(entryId),
        exportName: entryId.split('#')[1] || component.name,
      }
    },
  })
}
```
