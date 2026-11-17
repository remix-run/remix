# Bookstore Demo

This demo is a complete online bookstore built with Remix. Browse books, manage a cart, check out, update your account, and manage the store from an admin area.

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

## Server

- Pages render on the server, with browser interactions added where useful.
- The production server compresses responses and minifies browser assets.
- A Content Security Policy protects the app's scripts and styles and prevents embedding it on other sites.

## Data

- SQLite stores the catalog, customers, and orders using typed table definitions.
- Migrations manage the database schema, and seeds provide sample books and demo accounts.
- Checkout creates an order and its items together in a database transaction.

## Auth and Sessions

- Signed session cookies support login state and shopping carts.
- Customers can register, sign in, reset passwords, update their account, and view order history.
- Admin permissions protect book, user, and order management, including cover uploads.

## Assets

- Catalog images and browser assets use content hashes in their production URLs. Catalog images are cached as immutable assets for a year.
- Catalog and product pages share image URLs so the browser can reuse downloaded images.
- Product pages preload the main image; remaining carousel images load lazily.

## Frames

- Cart buttons and cart items reload their own frames after updates, keeping changes local to the affected UI. Quantity updates use PATCH and removals use DELETE at `/cart/items`, returning updated HTML in one enhanced request.
- Header links prefetch on hover or focus, while book details prefetch as their links enter the viewport. Login is excluded from prefetching.
- The [browser entry](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/actions/public/entry.tsx) uses `defaultResolveFrame` to customize caching and wrap page updates in view transitions. Prefetching uses Remix's built-in strategy.

## Caching

- Browsing frame responses can be reused for 30 seconds, including prefetched HTML. Full document responses to those pages disable caching.
- Cart mutations update the session cookie, preventing subsequent browsing navigations from reusing HTML cached for the previous cookie.
- Cart documents and fragments explicitly disable caching. Checkout, account, admin, and auth handlers other than registration do not set the 30-second browsing cache policy.
- Back and Forward can reuse stale browsing HTML from the browser cache beyond the 30-second window.

## Forms

- Shared schemas validate input in the browser and on the server.
- Failed submissions preserve entered values and show field and form errors. Rejected cart quantities show feedback on the affected row.
- Native cart forms redirect back to the cart and use session flash messages for validation feedback.
- Shared field components keep labels, controls, and validation messages consistent.

## UI

- Page navigations slide and fade by default, while the header and footer stay steady.
- Navigating to or from a product page animates the book cover and title between their card and detail views, including on Back and Forward.
- Animations respect reduced-motion preferences and fall back to ordinary updates in browsers without view transition support.
- Cart rows stay visible while saving, with pending indicators on buttons and saved totals. Failed requests restore the previous quantity and offer retry or reload.
- Removing a focused cart row moves focus to the cart region, including when the cart becomes empty.

## Development

- `pnpm dev` restarts the server when source files change.
- `pnpm hmr` enables hot module replacement for browser components and reloads frames after server updates.
- Development keeps asset URLs stable and revalidates changed files.
- `pnpm test` runs the demo's tests, and `pnpm typecheck` checks its TypeScript types.

### Database Commands

The setup command above creates `db/bookstore.sqlite`, applies the migrations, and loads the sample catalog and accounts. You can manage it with:

```sh
pnpm db:status
pnpm db:migrate
pnpm db:rollback
pnpm db:seed
pnpm db:reset
```

`db:rollback` reverts the latest migration, while `db:reset` recreates the database from scratch. The other commands let you inspect or update it without discarding your local changes.

## Explore the Code

- [Routes](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/routes.ts) and [router](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/router.ts): URL definitions and middleware.
- [Books](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/actions/books), [cart](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/actions/cart), and [checkout](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/actions/checkout): storefront flows.
- [Auth](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/actions/auth), [account](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/actions/account), and [admin](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/actions/admin): customer and store management.
- [Shared UI](https://github.com/remix-run/remix/tree/main/demos/bookstore/app/ui) and [data schema](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/data/schema.ts): reusable components and database tables.
