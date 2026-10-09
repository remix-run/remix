Add passkey registration and sign-in (see #11965). Users can add passkeys to their accounts and sign in with them without a password, including username-less sign-in and passkey autofill.

`createPasskeyAuthProvider()` configures the relying party ID, allowed origins, user verification policy, an app-owned challenge store, and a `findCredential()` lookup for stored credentials. `startPasskeyRegistration()` and `startPasskeyAuthentication()` issue expiring challenges bound to the session, the ceremony, and the account where one is known, and return JSON-serializable WebAuthn options. `finishPasskeyRegistration()` and `finishPasskeyAuthentication()` verify the browser response and return `{ ok: true, credential }`, or `{ ok: false, error }` for expired, reused, or concurrently redeemed challenges, origin and relying party mismatches, failed user verification, invalid signatures, and revoked credentials. Verification uses Web Crypto and supports ES256, EdDSA (Ed25519), and RS256 passkeys. `createMemoryPasskeyChallengeStore()` provides an in-process challenge store for development and tests.

The new `@remix-run/auth/browser` entrypoint exports `createPasskey()`, `getPasskey()`, `isPasskeySupported()`, and `isPasskeyAutofillSupported()`. They run the browser's passkey prompts or autofill from the server's options and report unsupported browsers, cancellation, and errors as results instead of throwing.

```ts
let result = await finishPasskeyAuthentication(passkeyProvider, context, {
  response: context.get(FormData).get('response'),
})

if (result.ok) {
  await db.passkeys.update(result.credential.id, { counter: result.credential.counter })
  completeAuth(context).set('auth', { userId: result.credential.userId })
}
```
