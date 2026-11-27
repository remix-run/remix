# Social Auth Demo

This demo shows how to combine `remix/auth`, `remix/middleware/auth`, `remix/data-schema`, and `remix/data-table` to build a small auth application with:

- credentials login with email and password
- passwordless sign-in with a magic link or an emailed one-time code
- external login with Google, GitHub, and X
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

## Demo Accounts

These seeded local users are available for the credentials flow:

- `admin@example.com` / `password123`
- `user@example.com` / `password123`

## Environment Variables

The demo supports these environment variables:

- `SESSION_SECRET`
- `EMAIL_OTP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`

Only `SESSION_SECRET` and `EMAIL_OTP_SECRET` are needed for the local credentials and email flows. The demo still starts if any social-provider variables are missing. In that case, the corresponding provider button stays visible but disabled on the login page.

## Provider Callback URLs

If you configure the external providers locally, use these callback URLs:

- `http://127.0.0.1:44100/auth/google/callback`
- `http://127.0.0.1:44100/auth/github/callback`
- `http://127.0.0.1:44100/auth/x/callback`

## What This Demo Shows

- request-time auth resolution with `remix/middleware/auth`
- credentials login with `verifyCredentials()` and `completeAuth()`
- magic link sign-in with `sendMagicLink()`, a `GET` confirmation page that email link scanners cannot use up, and `verifyMagicLink()` on `POST`
- email code sign-in with `sendEmailOTP()` and `verifyEmailOTP()`, including resend limits and attempt counts
- an `EmailAuthStorage` adapter backed by SQLite in [`app/utils/email-auth.ts`](app/utils/email-auth.ts)
- external auth with `startExternalAuth()`, `finishExternalAuth()`, and `completeAuth()`
- module-scope provider configuration with a boot-time provider registry
- form parsing with `remix/data-schema/form-data`
- local persistence with `remix/data-table` and SQLite
- rendering pages with `remix/component`

## Email Sign-In

Choose **Email Me a Sign-In Link** or **Email Me a Code** on the login page. The demo does not send email. Instead, the latest sign-in email for each address appears in a **Demo inbox** panel on the next page. Replace `sendOutboxEmail()` in [`app/utils/email-auth.ts`](app/utils/email-auth.ts) with your email service in a real app.

A verified address signs in the matching user. If no user has that address yet, the demo creates one, because the person has just proven they own it. Password signups in this demo do not verify email, so someone could register an address they do not own. The first email sign-in for such an account marks the address verified and removes the password set before verification.

## Data Storage

The demo keeps its runtime schema in `app/data/`, its SQLite database and migrations in `db/`, and its session files in `tmp/`. Pending magic links and email codes live in the `email_auth_entries` table. The database connection, migrations, and seed file are configured in [`remix.json`](remix.json).

Use `pnpm db:status` to inspect migrations, `pnpm db:migrate` to apply them, `pnpm db:rollback` to revert the latest one, and `pnpm db:seed` to reload the demo accounts. Run `pnpm db:reset` whenever you want a fresh database.

On successful external login, the demo:

- creates or updates a local `users` row
- stores linked provider data in `auth_accounts`
- persists a small session auth record
- renders an account page showing the local user plus provider/account data
