Add `auth`, a high-level browser authentication package for Remix.

Includes:

- generic `oidc()` support for standards-based providers
- thin `microsoft()`, `okta()`, and `auth0()` wrappers on top of OIDC
- OAuth provider helpers for Google, GitHub, and Facebook
- `credentials()` for email/password and other direct login flows
- composable `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, and `completeAuth()` primitives for session-backed browser authentication
- auth helpers that preserve richer `fetch-router` request context types
