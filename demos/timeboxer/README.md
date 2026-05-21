# Timeboxer Demo

A small schedule-planning app that demonstrates username/password authentication, session-backed route protection, SQLite persistence, JSON schedule endpoints, ICS export, and progressively enhanced Remix UI.

## Running the Demo

```sh
cd demos/timeboxer
cp .env.example .env
pnpm install
pnpm start
```

Then visit [http://localhost:44100](http://localhost:44100).

## Environment Variables

- `SESSION_SECRET` signs the session cookie and is required outside tests.
- `DATABASE_URL` optionally overrides the local SQLite path. By default the demo stores data in `db/timebox.sqlite`.

## Code Highlights

- [`app/routes.ts`](app/routes.ts) defines the route contract for auth, schedules, assets, and the home redirect.
- [`app/router.ts`](app/router.ts) composes sessions, form parsing, CSRF protection, database loading, and auth identity before mapping controllers.
- [`app/controllers/auth/controller.tsx`](app/controllers/auth/controller.tsx) owns signup, login, logout, and account routes.
- [`app/controllers/schedules/controller.ts`](app/controllers/schedules/controller.ts) owns schedule CRUD, optimistic revision checks, and calendar export.
- [`app/ui/schedule-layout.ts`](app/ui/schedule-layout.ts), [`app/ui/schedule-grid.tsx`](app/ui/schedule-grid.tsx), and [`app/ui/schedule-sidebar.tsx`](app/ui/schedule-sidebar.tsx) show hydrated schedule editing on top of server-rendered pages.
