`renderToStream()` now accepts a `resolveClientEntryResourceHints({ clientEntryIds, clientEntryHrefs })` callback for collecting client-entry resource hints during server rendering.

For example:

```ts
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import type { ResourceHintDescriptor } from 'remix/component/server'

export function render(node: RemixNode) {
  return renderToStream(node, {
    async resolveClientEntryResourceHints({ clientEntryHrefs }) {
      return clientEntryHrefs.map(
        (href) => ({ rel: 'modulepreload', href }) satisfies ResourceHintDescriptor,
      )
    },
  })
}
```
