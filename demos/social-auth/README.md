# Social Auth Demo

This demo shows how to combine `remix/auth`, `remix/auth-middleware`, `remix/data-schema`, and `remix/data-table` to build a small auth application with:

- credentials login with email and password
- external login with Google, GitHub, X, and Atmosphere
- signup, forgot-password, and reset-password flows
- session-backed route protection
- a local SQLite database for users and linked provider accounts

## Running the Demo

```sh
cd demos/social-auth
cp .env.example .env
pnpm install
pnpm start
```

Then visit [http://127.0.0.1:44100](http://127.0.0.1:44100).

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

Only `SESSION_SECRET` is needed for the local credentials flow. Google, GitHub, and X remain optional and stay visible but disabled when their variables are missing. Atmosphere uses the localhost loopback client-id flow, so it works without additional Atmosphere-specific environment variables.

## Provider Callback URLs

If you configure the external providers locally, use these callback URLs:

- `http://127.0.0.1:44100/auth/google/callback`
- `http://127.0.0.1:44100/auth/github/callback`
- `http://127.0.0.1:44100/auth/atmosphere/callback`
- `http://127.0.0.1:44100/auth/x/callback`

## What This Demo Shows

- request-time auth resolution with `remix/auth-middleware`
- credentials login with `verifyCredentials()` and `completeAuth()`
- external auth with `startExternalAuth()`, `finishExternalAuth()`, `completeAuth()`, and `refreshExternalAuth()`
- async external auth setup for Atmosphere using a user-supplied Bluesky handle or DID
- module-scope provider configuration with a boot-time provider registry
- form parsing with `remix/data-schema/form-data`
- local persistence with `remix/data-table` and SQLite
- rendering pages with `remix/component`

## Data Storage

The demo keeps its runtime schema and setup code in `demos/social-auth/app/data/`, its SQLite files and migrations in `demos/social-auth/db/`, and its session files in `demos/social-auth/tmp/`.

On successful external login, the demo:

- creates or updates a local `users` row
- stores linked provider data in `auth_accounts`
- persists a small session auth record
- stores external provider token bundles server-side in SQLite as encrypted JSON
- refreshes provider tokens later, on demand, when a follow-up request needs them
- renders an account page showing the local user plus provider/account data

To keep the example easy to follow, the demo uses a small app-owned recipe:

1. persist provider tokens in the callback route
2. load the stored tokens later for a follow-up request
3. refresh them only if they are expired and a refresh token is available
4. save the refreshed token bundle back to storage

That recipe lives in `app/utils/auth-account-tokens.ts`, while provider-specific refresh behavior lives in `app/utils/external-auth.ts`. In a real app, you may also want a dedicated encryption secret, key rotation, and stronger token-management policies.
