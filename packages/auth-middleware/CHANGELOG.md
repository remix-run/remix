# `auth-middleware` CHANGELOG

This is the changelog for [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Renamed the auth context helper types from `WithAuth` and `WithRequiredAuth` to `ContextWithAuth` and `ContextWithRequiredAuth` so auth middleware follows the `ContextWith*` naming pattern for helpers that produce refined `RequestContext` types.

  ```ts
  // before
  type AppAuthContext = WithRequiredAuth<AppContext, AuthIdentity>

  // after
  type AppAuthContext = ContextWithRequiredAuth<AppContext, AuthIdentity>
  ```

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
