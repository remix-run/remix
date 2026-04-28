Added `refreshExternalAuth()` to `@remix-run/auth` so apps can exchange stored refresh tokens for fresh OAuth and OIDC token bundles.

The built-in OIDC providers, X, and Atmosphere now implement refresh-token exchange. Refreshed token bundles preserve the existing refresh token when the provider omits a rotated value.
