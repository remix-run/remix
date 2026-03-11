Add `auth-middleware`, a pluggable authentication middleware package for `fetch-router`.

Includes:

- `auth()` for resolving request authentication state with `context.get(Auth)`
- `requireAuth()` for enforcing authenticated access with configurable failure responses
- Built-in `bearer()`, `apiKey()`, and `sessionAuth()` authentication schemes
