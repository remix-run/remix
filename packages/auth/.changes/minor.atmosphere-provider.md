Added `createAtmosphereAuthProvider(handleOrDid, options)` to support atproto OAuth flows against Atmosphere-compatible authorization servers.

The new provider resolves handles and DIDs before redirecting, performs required pushed authorization requests with DPoP, supports both public web clients and localhost loopback development clients, and seals per-session DPoP state into the in-flight OAuth transaction using the required `sessionSecret` option instead of a separate persistent store.
