# Renderers Demo

Remix does not require `remix/ui`. This demo renders the same guestbook with two different view libraries, each installed per controller with the `renderWith()` escape hatch from `remix/middleware/render`:

- **Preact** under `/preact`, with the browser loading Preact from `node_modules` through the Remix asset server.
- **React** under `/react`, with the browser loading React through an import map from [esm.unpkg.com](https://esm.unpkg.com), which converts React's CommonJS packages to ES modules on demand.

Both share one route shape, one SQLite database, and one validation module.

## Running the Demo

```sh
cd demos/renderers
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm start
```

Then visit [http://localhost:44100](http://localhost:44100).

## Database Commands

Entries are stored in SQLite at `db/guestbook.sqlite` using Node's built-in `node:sqlite` through `remix/data-table/sqlite`. [`remix.json`](remix.json) points the `remix db` CLI at the same file, migrations, and seed:

- `pnpm db:status` lists applied and pending migrations
- `pnpm db:migrate` applies pending migrations
- `pnpm db:seed` inserts the starter entries (safe to re-run)
- `pnpm db:rollback` reverts the latest migration
- `pnpm db:reset` recreates the database from scratch

Tests run against an in-memory database that is reset from the same migrations and seed before each test.

## What It Shows

- **A custom renderer in ~10 lines.** [`app/actions/preact/renderer.ts`](app/actions/preact/renderer.ts) wraps `preact-render-to-string/stream`; [`app/actions/react/renderer.ts`](app/actions/react/renderer.ts) wraps `react-dom/server`'s `renderToReadableStream`. Actions call `render(<Page />, { status: 404 })` exactly like they would with the Remix UI renderer.
- **Renderer scoped to a controller.** Each controller installs its renderer as controller middleware, so `context.render` is typed as that library's renderer inside the controller. The root controller has none, and renders the index page with `remix/html-template`.
- **Two JSX runtimes in one app.** The root `tsconfig.json` sets `jsxImportSource: "preact"`; files under [`app/actions/react/`](app/actions/react) opt into React with a `/** @jsxImportSource react */` pragma. TypeScript, `remix/node-tsx`, and the asset server all honor the pragma.
- **Framework code through the asset server.** [`app/utils/assets.ts`](app/utils/assets.ts) allows `preact` with `allowPackages` and marks `react`, `react/jsx-runtime`, and `react-dom/client` as `scripts.external`, so those specifiers reach the browser untouched for the import map to resolve.
- **A version-locked import map.** [`app/actions/react/import-map.ts`](app/actions/react/import-map.ts) builds the map from the `version` exported by the installed `react`, so client and server always run the same React. `react-dom/client` is requested with `?external=react` so its internal `react` import also resolves through the map instead of pulling a second copy.
- **Progressive enhancement with hydration.** Both `entry-form.tsx` files render as a plain `<form method="post">`. Each `public/entry.tsx` hydrates it in place from serialized props, adding a live character count and client-side validation that shares [`validate-entry.ts`](app/utils/public/validate-entry.ts) with the server action.
- **Status codes and redirects from the action.** Invalid submissions re-render with `400`, unknown entries render a `404` page, and successful signatures `303` back to the guestbook.
- **Typed database access.** [`app/middleware/database.ts`](app/middleware/database.ts) puts the `remix/data-table` database on `context.db`, and [`app/data/schema.ts`](app/data/schema.ts) defines the `entries` table so `db.findMany()`, `db.find()`, and `db.create()` are fully typed.

## Layout

```text
app/
  routes.ts                    `preact` and `react` route maps share one shape
  router.ts                    root middleware, maps all controllers
  db.ts                        SQLite database, migration and seed loaders
  actions/
    controller.ts              assets + home; no renderer installed
    home-page.ts               index page as an html`` template
    preact/
      controller.tsx           middleware: [preactRenderer()]
      renderer.ts              renderWith() over preact-render-to-string
      document.tsx             <html> shell with module preloads
      guestbook-page.tsx, entry-page.tsx
      public/entry.tsx         hydrate()
      public/entry-form.tsx
    react/
      controller.tsx           middleware: [reactRenderer()]
      renderer.ts              renderWith() over react-dom/server
      import-map.ts            esm.unpkg.com URLs pinned to the installed React
      document.tsx             <html> shell with the import map
      guestbook-page.tsx, entry-page.tsx
      public/entry.tsx         hydrateRoot()
      public/entry-form.tsx
  data/schema.ts               `entries` table definition
  middleware/database.ts       context.db
  utils/
    assets.ts                  asset server, externals, entry hrefs
    json-script.ts             safe JSON for inline <script> props
    public/validate-entry.ts   shared by both renderers, server and client
db/
  migrations/                  SQL migrations run by `remix db`
  seed.sql
```

## Notes on the React Setup

- **No `modulepreload` links in the React document.** React 19 hoists `<link>` elements above the import map, and browsers ignore an import map that appears after a module load has started. The Preact document keeps its preloads because Preact renders head elements in source order.
- **esm.unpkg.com caches by path, ignoring the query string.** Whichever build variant of a given URL reaches a Cloudflare edge first is what that edge serves afterwards, so `?external=react` can be silently dropped if a plain `react-dom@<version>/client` was requested there earlier. If hydration fails with "Invalid hook call", that is the cause. This is an upstream issue, not something the app can work around.

## Adding Another Renderer

Add a route map in `app/routes.ts`, a controller folder under `app/actions/<renderer>/` with its own `renderer.ts`, and either allow the framework package in `app/utils/assets.ts` or mark its specifiers external and supply an import map.

Solid does not fit this pattern yet: it has no compiler-free server rendering path. Both its SSR and client output come from `babel-preset-solid`, which sits outside what `remix/node-tsx` and the asset server compile.
