# `auth` CHANGELOG

This is the changelog for [`auth`](https://github.com/remix-run/remix/tree/main/packages/auth). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- Added `createAtmosphereAuthProvider(options)` to support atproto OAuth flows against Atmosphere-compatible authorization servers.

  The new provider resolves handles and DIDs with `provider.prepare(handleOrDid)` before redirecting, performs required pushed authorization requests with DPoP, supports both public web clients and localhost loopback development clients, and seals per-session DPoP state into the in-flight OAuth transaction using the required `sessionSecret` option instead of a separate persistent store.

  Create the Atmosphere provider once with shared options, call `provider.prepare(handleOrDid)` only before `startExternalAuth()`, and pass the module-scope provider directly to `finishExternalAuth()` and `refreshExternalAuth()`. Atmosphere callback results preserve the DPoP binding state and authorization server refresh details alongside the returned `accessToken` and `refreshToken`, so callers can reuse the completed token bundle directly for refresh-token exchange and follow-up DPoP-signed requests.

- Added `refreshExternalAuth()` to `@remix-run/auth` so apps can exchange stored refresh tokens for fresh OAuth and OIDC token bundles.

  The built-in OIDC providers, X, and Atmosphere now implement refresh-token exchange. Refreshed token bundles preserve the existing refresh token when the provider omits a rotated value.

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## v0.1.0

### Minor Changes

- Add `auth`, a high-level browser authentication package for Remix.

  Includes:

  - generic `oidc()` support for standards-based providers
  - thin `microsoft()`, `okta()`, and `auth0()` wrappers on top of OIDC
  - OAuth provider helpers for Google, GitHub, and Facebook
  - `credentials()` for email/password and other direct login flows
  - composable `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, and `completeAuth()` primitives for session-backed browser authentication
  - auth helpers that preserve richer `fetch-router` request context types

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)
