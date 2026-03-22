Add `auth-middleware`, a pluggable authentication middleware package for `fetch-router`.

Includes:

- the `Auth` context key and `AuthState` for reading request auth state with `context.get(Auth)`
- `auth()` for resolving request authentication state with `context.get(Auth)`
- `requireAuth()` for enforcing authenticated access with configurable failure responses
- `WithAuth` and `WithRequiredAuth` for app-level request context contracts
- built-in `createBearerTokenAuthScheme()`, `createAPIAuthScheme()`, and `createSessionAuthScheme()` helpers
