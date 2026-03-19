# Social Login Demo

This demo shows how to combine `remix/auth`, `remix/auth-middleware`, `remix/data-schema`,
and `remix/data-table` to build a small auth application with:

- credentials login with email and password
- external login with Google, GitHub, and X
- signup, forgot-password, and reset-password flows
- session-backed route protection
- a local SQLite database for users and linked provider accounts

## Running the Demo

```sh
cd demos/social-login
cp .env.example .env
pnpm install
pnpm start
```

Then visit [http://localhost:44100](http://localhost:44100).

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

Only `SESSION_SECRET` is needed for the local credentials flow. The demo will still start if any
social-provider variables are missing. In that case, the corresponding provider button stays
visible but disabled on the login page.

## Provider Callback URLs

If you configure the external providers locally, use these callback URLs:

- `http://localhost:44100/auth/google/callback`
- `http://localhost:44100/auth/github/callback`
- `http://localhost:44100/auth/x/callback`

## What This Demo Shows

- request-time auth resolution with `remix/auth-middleware`
- credentials login with `createCredentialsAuthLoginRequestHandler()`
- external auth with:
  - `createExternalAuthLoginRequestHandler()`
  - `createExternalAuthCallbackRequestHandler()`
- form parsing with `remix/data-schema/form-data`
- local persistence with `remix/data-table` and SQLite
- rendering pages with `remix/component`

## Data Storage

The demo keeps its SQLite database in `demos/social-login/data/` and its session files in
`demos/social-login/tmp/`.

On successful external login, the demo:

- creates or updates a local `users` row
- stores linked provider data in `auth_accounts`
- persists a small session auth record
- renders an account page showing the local user plus provider/account data
