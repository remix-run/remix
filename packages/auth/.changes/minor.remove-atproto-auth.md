BREAKING CHANGE: Remove the built-in Atmosphere auth provider and the provider-specific token model added for its DPoP flow. This removes `createAtmosphereAuthProvider()`, the `Atmosphere*` and `OAuthDpop*` types, `OAuthStandardTokens`, and the token type parameter from `OAuthProvider`, `OAuthResult`, and the external auth result types.

Use `OAuthTokens` in place of `OAuthStandardTokens` and remove the third type argument from shared OAuth types. Applications using the Atmosphere provider must remove it or move their atproto authentication to a separate integration.
