# `auth` CHANGELOG

This is the changelog for [`auth`](https://github.com/remix-run/remix/tree/main/packages/auth). It follows [semantic versioning](https://semver.org/).

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
