# Social Login Demo

A one-page Remix app that shows the new auth stack working against a real SQLite database. It combines `remix/auth`, `remix/auth-middleware`, `remix/data-table`, `remix/data-table/migrations`, `remix/data-table-sqlite`, and standard router middleware without any AsyncLocalStorage helper.

## Running the Demo

```bash
cd demos/social-login
pnpm install
cp .env.example .env
pnpm start
```

Then visit:

- `http://127.0.0.1:44100`

## Environment Setup

Social login is optional. Copy [`.env.example`](./.env.example) to `.env` and fill in whichever provider credentials you want to enable:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`

The demo uses Node's built-in `.env` loading to read that file on startup. If `.env` is missing, the app still boots, the email/password flow still works, and the console explains how to create the file.

Register these callback URLs with your provider apps:

- Google: `http://127.0.0.1:44100/auth/google/callback`
- GitHub: `http://127.0.0.1:44100/auth/github/callback`
- X: `http://127.0.0.1:44100/auth/x/callback`

Use `http://127.0.0.1:44100/` as the demo website URL when a provider asks for one. X requires an exact callback match and its docs specifically call out `127.0.0.1` for local development instead of `localhost`, so the demo uses the loopback address consistently for all provider instructions.

## Local Account

The demo seeds one local user into SQLite on first boot:

- `demo@example.com`
- `password123`

## Database and Migrations

- The SQLite file is stored at `data/social-login.sqlite`
- Migration files live in `data/migrations`
- On startup, the app loads migrations from `data/migrations`, runs pending migrations, and seeds the local email/password account if the database is empty

## Code Highlights

- [`app/router.ts`](./app/router.ts) composes the app out of `formData()`, sessions, request-scoped database loading, and global auth loading.
- [`app/data/setup.ts`](./app/data/setup.ts) bootstraps SQLite with `better-sqlite3`, `remix/data-table`, and `remix/data-table/migrations`.
- [`data/migrations/20260311170000_create_social_login_schema.ts`](./data/migrations/20260311170000_create_social_login_schema.ts) defines the `users` and `auth_accounts` tables.
- [`app/middleware/database.ts`](./app/middleware/database.ts) stores the database handle in request context with `context.set(...)` and `context.get(...)`.
- [`app/middleware/auth.ts`](./app/middleware/auth.ts) contains the demo auth stack in one place: `loadAuth()`, the email/password credentials provider, social provider creation, and the social-account upsert logic.
- [`app/auth.tsx`](./app/auth.tsx) uses `login()` and `callback()` from `remix/auth` for both the local password flow and the Google/GitHub/X flows.
- [`app/home.tsx`](./app/home.tsx) renders the whole app from one request handler and switches between the signed-out and signed-in states by reading `context.get(Auth)`.
- [`app/router.test.ts`](./app/router.test.ts) covers password login, all three OAuth callback flows, and logout session rotation.
- [`app/data/setup.test.ts`](./app/data/setup.test.ts) verifies that migrations are applied and the seeded user is created only once.
