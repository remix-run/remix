Add `auth-middleware`, a pluggable authentication middleware package for `fetch-router`.

Includes:

- `auth()` for resolving request authentication state (`context.auth`)
- `requireAuth()` for enforcing authenticated access with configurable failure responses
- Built-in `bearer()` and `apiKey()` authentication schemes
