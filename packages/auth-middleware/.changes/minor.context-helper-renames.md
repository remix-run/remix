BREAKING CHANGE: Removed the `ContextWithAuth` and `ContextWithRequiredAuth` helper types. Derive auth-aware request context from the actual auth middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper when manually composing context types without a middleware tuple.

```ts
import { requireAuth } from 'remix/auth-middleware'
import type { MiddlewareContext } from 'remix/fetch-router'

let protectedMiddleware = [requireAuth<AuthIdentity>()] as const
type AppAuthContext = MiddlewareContext<typeof protectedMiddleware, AppContext>
```
