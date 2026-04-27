Added `createAtmosphereAuthProvider(options)(handleOrDid)` to support atproto OAuth flows against Atmosphere-compatible authorization servers.

The new provider resolves handles and DIDs before redirecting, performs required pushed authorization requests with DPoP, supports both public web clients and localhost loopback development clients, and seals per-session DPoP state into the in-flight OAuth transaction using the required `sessionSecret` option instead of a separate persistent store.

Create the Atmosphere factory once with shared options, then call the returned function with the request-time handle or DID before passing the provider to `startExternalAuth()`, `finishExternalAuth()`, or `refreshExternalAuth()`. Atmosphere callback results preserve the DPoP binding state alongside the returned `accessToken` and `refreshToken`, so callers can reuse the completed token bundle directly for follow-up DPoP-signed requests.
