# `auth-middleware` CHANGELOG

This is the changelog for [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware). It follows [semantic versioning](https://semver.org/).

## v0.2.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.20.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.0)

## v0.2.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.2)

## v0.2.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.1)
  - [`session@0.4.2`](https://github.com/remix-run/remix/releases/tag/session@0.4.2)

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Removed the `ContextWithAuth` and `ContextWithRequiredAuth` helper types. Derive auth-aware request context from the actual auth middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper when manually composing context types without a middleware tuple.

  ```ts
  import { requireAuth } from 'remix/auth-middleware'
  import type { MiddlewareContext } from 'remix/fetch-router'

  let protectedMiddleware = [requireAuth<AuthIdentity>()] as const
  type AppAuthContext = MiddlewareContext<typeof protectedMiddleware, AppContext>
  ```

- `auth()` now installs resolved auth state as `context.auth` in addition to `context.get(Auth)`. `requireAuth()` narrows `context.auth` and `context.get(Auth)` to `GoodAuth<identity>` for protected handlers.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)

## v0.1.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.2)

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## v0.1.0

### Minor Changes

- Add `auth-middleware`, a pluggable authentication middleware package for `fetch-router`.

  Includes:

  - the `Auth` context key and `AuthState` for reading request auth state with `context.get(Auth)`
  - `auth()` for resolving request authentication state with `context.get(Auth)`
  - `requireAuth()` for enforcing authenticated access with configurable failure responses
  - `WithAuth` and `WithRequiredAuth` for app-level request context contracts
  - built-in `createBearerTokenAuthScheme()`, `createAPIAuthScheme()`, and `createSessionAuthScheme()` helpers

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)
