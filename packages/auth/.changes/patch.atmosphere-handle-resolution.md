Fix `createAtmosphereAuthProvider()` handle resolution so a successful DNS or HTTPS handle lookup can start the OAuth flow immediately instead of waiting for the other lookup branch to finish.
