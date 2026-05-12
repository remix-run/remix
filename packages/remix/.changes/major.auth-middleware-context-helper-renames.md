BREAKING CHANGE: Removed the `ContextWithAuth` and `ContextWithRequiredAuth` helper types from `remix/middleware/auth`. Derive auth-aware request context from the actual auth middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper from `remix/router` when manually composing context types without a middleware tuple.

```ts
import { requireAuth } from 'remix/middleware/auth'
import type { MiddlewareContext } from 'remix/router'

let protectedMiddleware = [requireAuth<AuthIdentity>()] as const
type AppAuthContext = MiddlewareContext<typeof protectedMiddleware, AppContext>
```
