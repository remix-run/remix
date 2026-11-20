# Passkeys Demo

This demo is a passwordless app where passkeys are the only way to sign in. It shows how to wire the WebAuthn helpers from `remix/auth` and `remix/auth/webauthn-client` into a real app with:

- sign-up that creates the account and its first passkey together
- sign-in from the browser's username autofill, or with a button
- an account page for adding passkeys on other devices and removing old ones
- passkeys stored in SQLite, with the sign counter saved after every sign-in

## Running the Demo

```sh
cd demos/passkeys
pnpm install
pnpm db:reset
pnpm start
```

Then visit [http://localhost:44100](http://localhost:44100). Use `localhost`, not `127.0.0.1`: browsers don't allow passkeys on IP addresses.

Passkeys are bound to the site's hostname. To run the demo somewhere else, set `ORIGIN` to the URL the browser opens, such as `ORIGIN=https://passkeys.example.com`. Browsers only allow passkeys on `https` origins and `localhost`. Set `SESSION_SECRET` to sign session cookies with your own secret.

## How It Works

Each passkey flow is two requests. The browser asks the server for options, which stores a one-time challenge in the session. The browser shows its passkey prompt, then sends the result back, and the server verifies it against that challenge.

| Flow          | Options                          | Verify                   | Browser helper    |
| ------------- | -------------------------------- | ------------------------ | ----------------- |
| Sign up       | `POST /auth/signup/options`      | `POST /auth/signup`      | `createPasskey()` |
| Sign in       | `POST /auth/login/options`       | `POST /auth/login`       | `getPasskey()`    |
| Add a passkey | `POST /account/passkeys/options` | `POST /account/passkeys` | `createPasskey()` |

- [`app/utils/passkeys.ts`](app/utils/passkeys.ts) configures the provider. Passkeys are the only way to sign in, so it requires user verification (a biometric or PIN) and discoverable credentials, which let users sign in without typing a username.
- [`app/actions/auth/controller.ts`](app/actions/auth/controller.ts) handles sign-up and sign-in. The account row is created only after the passkey verifies, so sign-up keeps the promised user id in the session until then.
- [`app/actions/account/controller.tsx`](app/actions/account/controller.tsx) lists, adds, and removes passkeys. New passkeys exclude the ones the user already has, so a device can't register twice, and the last passkey can't be removed.
- [`app/actions/public/passkey-sign-in.tsx`](app/actions/public/passkey-sign-in.tsx) starts a background sign-in request with `mediation: 'conditional'`, so the browser offers saved passkeys in the username field's autofill menu. Pressing the button cancels it and opens the full passkey prompt instead, since a page can only wait on one passkey request at a time.

## Things to Copy

- **Use an opaque user id.** The `users.id` UUID is also the WebAuthn user handle that every authenticator stores. Never use an email address or username there.
- **Store sessions on the server.** The demo uses file-based session storage. With cookie session storage, a replayed old cookie brings an answered challenge back.
- **Catch errors from the finish helpers.** Session changes are only saved when the route returns a response, and the finish helpers remove the challenge from the session even when verification fails.
- **Save the credential after every sign-in.** `finishWebAuthnAuthentication()` returns the updated sign counter, which detects cloned authenticators.

## Tests

`pnpm test` runs both kinds of tests:

- [`app/router.test.ts`](app/router.test.ts) covers the server's validation and error responses.
- [`app/passkeys.test.e2e.ts`](app/passkeys.test.e2e.ts) drives Chromium with a virtual authenticator from the Chrome DevTools Protocol. The authenticator creates real key pairs and signatures, so these tests exercise the full sign-up, sign-in, and passkey management flows.
