BREAKING CHANGE: Removed the `ContextWithRenderer` helper type from `remix/render-middleware`. Derive renderer-aware request context from the `renderWith()` middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper from `remix/fetch-router` when manually composing context types without a middleware tuple.

```ts
import { renderWith } from 'remix/render-middleware'
import type { MiddlewareContext } from 'remix/fetch-router'

let render = renderWith(() => (value: string) => new Response(value))
type AppContext = MiddlewareContext<[typeof render]>
```
