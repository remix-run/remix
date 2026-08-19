# Bookstore Demo

This demo is a small but complete online bookstore. You can browse books, manage a cart, check out, update your account, and run the store from an admin area. It is a good place to see how routing, middleware, data, sessions, and progressively enhanced UI fit together in a Remix app.

## Run It

```sh
cd demos/bookstore
pnpm install
pnpm db:reset
pnpm start
```

Visit [http://localhost:44100](http://localhost:44100) and sign in with one of the demo accounts:

- Admin: `admin@bookstore.com` / `admin123`
- Customer: `customer@example.com` / `password123`

Use `pnpm dev` for automatic server restarts, or `pnpm hmr` to enable hot module replacement.

## Explore the Code

- Start with [`app/routes.ts`](app/routes.ts) and [`app/router.ts`](app/router.ts) to see the typed route contract and the middleware stack that serves it.
- Follow the storefront through [`app/actions/books`](app/actions/books), [`app/actions/cart`](app/actions/cart), and [`app/actions/checkout`](app/actions/checkout). These flows work on the server first, then add richer browser behavior where it helps.
- Look in [`app/actions/auth`](app/actions/auth), [`app/actions/account`](app/actions/account), and [`app/actions/admin`](app/actions/admin) for nested controllers, sessions, authorization, CRUD, and file uploads.
- [`app/ui`](app/ui) contains the shared document and layout pieces. Colocated `public` directories contain the browser code for cart fragments and the image carousel.
- [`app/data/schema.ts`](app/data/schema.ts), [`db/migrations`](db/migrations), and [`remix.json`](remix.json) show the typed SQLite schema and the `remix db` workflow.

## Database Commands

The setup command above creates `db/bookstore.sqlite`, applies the migrations, and loads the sample catalog and accounts. You can manage it with:

```sh
pnpm db:status
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

`db:reset` recreates the database from scratch. The other commands let you inspect or update it without discarding your local changes.
