BREAKING CHANGE: Renamed the `remix/auth-middleware` auth context helper types from `WithAuth` and `WithRequiredAuth` to `ContextWithAuth` and `ContextWithRequiredAuth` so middleware packages consistently use the `ContextWith*` naming pattern for helpers that produce refined `RequestContext` types.

```ts
// before
type AppAuthContext = WithRequiredAuth<AppContext, AuthIdentity>

// after
type AppAuthContext = ContextWithRequiredAuth<AppContext, AuthIdentity>
```
