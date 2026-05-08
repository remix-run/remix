BREAKING CHANGE: Renamed the auth context helper types from `WithAuth` and `WithRequiredAuth` to `ContextWithAuth` and `ContextWithRequiredAuth` so auth middleware follows the `ContextWith*` naming pattern for helpers that produce refined `RequestContext` types.

```ts
// before
type AppAuthContext = WithRequiredAuth<AppContext, AuthIdentity>

// after
type AppAuthContext = ContextWithRequiredAuth<AppContext, AuthIdentity>
```
