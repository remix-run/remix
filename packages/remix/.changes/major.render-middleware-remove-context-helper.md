BREAKING CHANGE: Removed the `ContextWithRenderer` helper type from `remix/middleware/render`. Derive renderer-aware request context from the `renderWith()` middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper from `remix/router` when manually composing context types without a middleware tuple.

```ts
import { renderWith } from 'remix/middleware/render'
import type { MiddlewareContext } from 'remix/router'

let render = renderWith(() => (value: string) => new Response(value))
type AppContext = MiddlewareContext<[typeof render]>
```
