# Social Auth Demo

This demo shows how to combine `remix/auth`, `remix/middleware/auth`, `remix/data-schema`, and `remix/data-table` to build a small auth application with:

- credentials login with email and password
- external login with Google, GitHub, and X
- passkey sign-in with a button or the browser's autofill menu
- passkey management on the account page: add, rename, and remove passkeys
- signup, forgot-password, and reset-password flows
- session-backed route protection
- a local SQLite database for users and linked provider accounts

## Running the Demo

```sh
cd demos/social-auth
cp .env.example .env
pnpm install
pnpm db:reset
pnpm start
```

Then visit [http://127.0.0.1:44100](http://127.0.0.1:44100).

Passkeys are tied to a domain name, and browsers do not allow them on IP addresses. To try passkeys, open [http://localhost:44100](http://localhost:44100) instead. Pages served from `127.0.0.1` link to the same page on `localhost`. The two addresses keep separate session cookies, so sign in again after switching.

## Demo Accounts

These seeded local users are available for the credentials flow:

- `admin@example.com` / `password123`
- `user@example.com` / `password123`

## Environment Variables

The demo supports these environment variables:

- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `PASSKEY_ORIGIN`

`PASSKEY_ORIGIN` defaults to `http://localhost:44100`. Its hostname becomes the passkey relying party ID, so set it to your HTTPS origin when you deploy the demo.

Only `SESSION_SECRET` is needed for the local credentials flow. The demo still starts if any social-provider variables are missing. In that case, the corresponding provider button stays visible but disabled on the login page.

## Provider Callback URLs

If you configure the external providers locally, use these callback URLs:

- `http://127.0.0.1:44100/auth/google/callback`
- `http://127.0.0.1:44100/auth/github/callback`
- `http://127.0.0.1:44100/auth/x/callback`

## What This Demo Shows

- request-time auth resolution with `remix/middleware/auth`
- credentials login with `verifyCredentials()` and `completeAuth()`
- external auth with `startExternalAuth()`, `finishExternalAuth()`, and `completeAuth()`
- passkey registration with `startPasskeyRegistration()` and `finishPasskeyRegistration()`, and passkey sign-in with `startPasskeyAuthentication()`, `finishPasskeyAuthentication()`, and `completeAuth()`
- browser passkey prompts and autofill with `createPasskey()` and `getPasskey()` from `remix/auth/browser` inside `clientEntry()` components
- a SQLite-backed passkey challenge store that makes each challenge single-use with an atomic delete
- module-scope provider configuration with a boot-time provider registry
- form parsing with `remix/data-schema/form-data`
- local persistence with `remix/data-table` and SQLite
- rendering pages with `remix/component`

## Data Storage

The demo keeps its runtime schema in `app/data/`, its SQLite database and migrations in `db/`, and its session files in `tmp/`. The database connection, migrations, and seed file are configured in [`remix.json`](remix.json).

Use `pnpm db:status` to inspect migrations, `pnpm db:migrate` to apply them, `pnpm db:rollback` to revert the latest one, and `pnpm db:seed` to reload the demo accounts. Run `pnpm db:reset` whenever you want a fresh database.

Registered passkeys live in the `passkeys` table, and pending passkey challenges live in `passkey_challenges` until they are used or expire.

Passkeys are added from the account page, so every passkey belongs to an account that also has a password or a linked social login. That other sign-in method is the account recovery path if a user loses access to their passkeys.

On successful external login, the demo:

- creates or updates a local `users` row
- stores linked provider data in `auth_accounts`
- persists a small session auth record
- renders an account page showing the local user plus provider/account data
