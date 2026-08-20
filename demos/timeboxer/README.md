# Timeboxer Demo

A small schedule-planning app that demonstrates username/password authentication, session-backed route protection, SQLite persistence, JSON schedule endpoints, ICS export, and progressively enhanced Remix UI.

## Running the Demo

```sh
cd demos/timeboxer
cp .env.example .env
pnpm install
pnpm db:reset
pnpm start
```

Then visit [http://localhost:44100](http://localhost:44100).

## Environment Variables

- `SESSION_SECRET` signs the session cookie and is required outside tests.
- `DATABASE_URL` optionally overrides the local SQLite path. By default the demo stores data in `db/timebox.sqlite`.

## Database Commands

Use `pnpm db:status` to inspect migrations, `pnpm db:migrate` to apply them, and `pnpm db:rollback` to revert the latest one. Run `pnpm db:reset` whenever you want to recreate the local database from scratch. These commands load the same `.env` file as the server, so `DATABASE_URL` selects the same database for both.

## Code Highlights

- [`app/routes.ts`](app/routes.ts) defines the route contract for auth, schedules, assets, and the home redirect.
- [`app/router.ts`](app/router.ts) composes sessions, form parsing, CSRF protection, database loading, and auth identity before mapping controllers.
- [`app/actions/auth/controller.tsx`](app/actions/auth/controller.tsx), [`app/actions/auth/login/controller.tsx`](app/actions/auth/login/controller.tsx), and [`app/actions/auth/signup/controller.tsx`](app/actions/auth/signup/controller.tsx) mirror the nested auth route maps.
- [`app/actions/schedules/controller.tsx`](app/actions/schedules/controller.tsx) owns schedule CRUD, optimistic revision checks, and calendar export.
- [`app/actions/public/entry.ts`](app/actions/public/entry.ts) boots the browser runtime, while the asset controller exposes only `app/routes.ts` and source under colocated `public/` directories.
- [`app/actions/schedules/public/schedule-layout.ts`](app/actions/schedules/public/schedule-layout.ts), [`app/actions/schedules/public/schedule-grid.tsx`](app/actions/schedules/public/schedule-grid.tsx), and [`app/actions/schedules/public/schedule-sidebar.tsx`](app/actions/schedules/public/schedule-sidebar.tsx) show hydrated schedule editing on top of server-rendered pages.
