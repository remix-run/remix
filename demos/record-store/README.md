# Record Store Demo

This demo is a complete online record store built with Remix. Browse records, manage a cart, check out, update your account, and manage the store from an admin area.

## Run It

```sh
cd demos/record-store
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
- Migrations manage the database schema, and seeds provide sample albums and demo accounts.
- The seed uses the 50 existing bookstore products, including their cover art. The homepage features the first four albums ordered by ID; `/albums` shows the full catalog. Run `pnpm db:seed` to add new seed entries to an existing database without resetting it.
- Ten broader categories group the catalog, with an average of five albums per category. Filters, related albums, and the admin category selector share this grouping. Run `pnpm db:migrate` to consolidate categories in an existing database while preserving albums, images, and orders.
- Checkout creates an order and its items together in a database transaction.

## Auth and Sessions

- The `record-store-session` cookie keeps login and cart state separate from the bookstore demo.
- Customers can register, sign in, reset passwords, update their account, and view order history.
- Admin permissions protect album, user, and order management, including cover uploads.

## Assets

- Catalog images and browser assets use content hashes in their production URLs. Catalog images are cached as immutable assets for a year.
- The asset server's `album-image-320`, `album-image-480`, `album-image-640`, `album-image-768`, and `album-image-960` transforms serve responsive WebP album images, preserving their aspect ratio without enlarging smaller originals. Transformed outputs use the asset server's disk cache.
- Cart items display 48×64-pixel covers using a separate `album-thumbnail` transform that serves 96×128 WebP images for sharper rendering on high-density displays.
- Catalog and product pages share image URLs so the browser can reuse downloaded images. Catalog images live in `app/images` and are served through the asset server at `/assets/app/images/…`. Stored catalog paths are resolved when rendering, so an existing database does not need to be reseeded. Uploaded covers continue to use `/uploads/…`.
- The homepage, albums list, and category pages preload their first cover early in the document head. Product pages preload the selected carousel image; remaining carousel images load lazily. Each preload matches the displayed image's responsive candidates and sizes.
- The album carousel preserves its selection with `?image=N`, using one-based image numbers and omitting the parameter for the first image. Arrow buttons call `updateUrl()` to replace the current URL without fetching the page. Reloads and shared links render and preload the selected image on the server; invalid or out-of-range values fall back to the first image.

## Frames

The cart demonstrates these application conventions for keeping mutations local while supporting ordinary document submissions:

- Each frame keeps its `src` pinned to one URL. Cart items load from `/cart/items`, and mutations leave both that source and the document URL unchanged, so a hard reload still loads `/cart`.
- HTTP methods select separate handlers at the frame URL: GET renders cart items, PATCH updates quantity, DELETE removes an item, and POST restores its saved quantity. Cart buttons use GET and POST at `/fragments/cart-button/:albumId`.
- Enhanced cart forms intercept submission and call `handle.frame.reload({ method: 'post', body })`. The mutation handler returns updated fragment HTML in the same request, avoiding a separate GET. PATCH and DELETE travel as POST with a hidden `_method` field, which the server's method-override middleware interprets.

Navigation and prefetching use frames too:

- Header links prefetch on hover or focus, while album details prefetch as their links enter the viewport. Login is excluded because rendering it consumes session flash messages.
- Product pages show up to three other albums in the same category below the details. A `loading="lazy"` frame loads them as the Related Records card approaches the viewport; its fallback reserves space and links to the category while loading.
- The browser entry owns the custom prefetch implementation and calls the [related-album prefetch manager](https://github.com/remix-run/remix/blob/main/demos/record-store/app/actions/public/related-album-prefetch-manager.ts) as one part of frame processing. The manager discovers the destination's lazy related-albums frame during viewport prefetching and queues its URL and target in a `WeakMap` keyed by the card's existing link. Hover or focus starts that queued request and prefetches its cover images. Intent arriving before discovery shares the pending page request. The queue retains no HTML or callbacks, releases frame references when started, and ignores removed or changed links. This extra prefetch runs once per mounted link and destination and respects Save-Data and slow connections. The entry's shared abort signal removes the manager's listeners and cancels pending prefetches during HMR disposal.
- The [browser entry](https://github.com/remix-run/remix/blob/main/demos/record-store/app/actions/public/entry.tsx) uses `defaultResolveFrame` to customize caching and wrap page updates in view transitions. Prefetching delegates to `defaultPrefetch` for HTML and asset discovery.
- Prefetching registers pending GETs with a shared [frame request manager](https://github.com/remix-run/remix/blob/main/demos/record-store/app/actions/public/frame-request-manager.ts). `resolveFrame` looks up matching URLs, frame targets, and request variants to join unfinished GETs, including streaming bodies; a lookup miss falls through to native `fetch`. Each caller receives its own response stream; canceling one caller leaves the others running. The manager drops completed responses, releases replay buffers and abort listeners, and cancels the transport when every caller cancels or HMR disposes the entry. Mutations prevent later GETs from joining requests started with the earlier session.

## Caching

- Browsing frame responses can be reused for 30 seconds, including prefetched HTML. Cached responses are private and vary by cookie and frame headers. Full document responses to those pages disable caching.
- Cart mutations update the session cookie, preventing subsequent browsing navigations from reusing HTML cached for the previous cookie.
- Cart documents and fragments explicitly disable caching. Checkout, account, admin, and auth handlers other than registration do not set the 30-second browsing cache policy.
- Back and Forward can reuse stale browsing HTML from the browser cache beyond the 30-second window.
- Related-frame GETs also use `force-cache` so lazy restoration can reuse stored HTML; prefetching follows normal cache freshness. Page transitions do not reload or wait for related frames to finish.

## Forms

- Shared schemas validate input in the browser and on the server. Controllers parse submissions with `fd.parseSafe` from `remix/data-schema/experimental/form`, then pass validated, typed data to mutation helpers. Browser forms use `form.Context` from `@remix-run/ui/form`.
- Native cart forms target the same frame URLs used by enhanced submissions. Each mutation has one handler; only the response branches between fragment HTML and a document redirect, keeping mutation logic in one place.
- Failed submissions preserve entered values and show field and form errors. Rejected cart quantities show feedback on the affected row.
- Document submissions use post/redirect/get (PRG). Cart item handlers redirect with 303 to `/cart`; cart buttons redirect to the same-origin initiating page. Errors and submitted values survive the redirect in session flash messages, which the frame GET reads to render contextual feedback.
- Cart items use ordinary `session.flash()`. Cart-button errors use the custom [flashUntilRead middleware](https://github.com/remix-run/remix/blob/main/demos/record-store/app/middleware/flash-until-read.ts), keyed by album, because parallel sibling frames can expire an ordinary flash before the intended button frame reads it.
- Cart buttons submit an explicit add or remove intent, and quantity forms submit the desired quantity. Retrying after a lost response preserves the requested result instead of toggling it back.
- The shared [Field component](https://github.com/remix-run/remix/blob/main/demos/record-store/app/ui/public/field.tsx) keeps labels, controls, and validation messages consistent.

## UI

- Page content, including album titles, cross-fades without sliding, while the header and footer stay steady. Page snapshots use the destination’s position and size, keeping the details panel steady when the catalog was scrolled.
- Navigating to or from a product page moves and resizes only the album cover between its card and faceout views when both images are rendered, including on Back and Forward. The shared [album transition mixin](https://github.com/remix-run/remix/blob/main/demos/record-store/app/ui/album-transitions.ts), `albumCoverTransition(album.id)`, activates matching names using per-album transition types. Only albums entering or leaving a faceout participate; other related cards cross-fade with the page. Browsers without transition types use only the page cross-fade.
- Animations respect reduced-motion preferences and fall back to ordinary updates in browsers without view transition support.
- Remix lifecycle events drive interaction feedback: cart components listen for frame `reloadStart`, while the shared [PendingButton](https://github.com/remix-run/remix/blob/main/demos/record-store/app/ui/public/pending-button.tsx) also supports `rmx:navigation`. Their `finished` promises determine completion. Abort and active-operation checks keep superseded work from overwriting current UI state.
- Small state machines model pending and failure feedback in cart items and `PendingButton`. Cart quantities use a non-editable number between decrease and increase buttons. The number updates optimistically, while saved prices stay visible with pending spinners until the server confirms the change. Quantity buttons prevent overlapping writes and stop at one. Failed requests restore the saved quantity, show an error, and allow retry or reload. The buttons also submit ordinary forms without JavaScript.
- Remove sends its request immediately and shrinks the row to a thumbnail, title, and Undo button for two seconds. A sliding button background shows the time remaining. Hover or keyboard focus resets the window to two seconds and pauses it until both leave. Local state keeps that row, including the last cart item, after the server response. Undo expands it optimistically and restores the saved quantity; requests are serialized, and restoration sets the quantity so retrying a lost response cannot add extra copies. Restored rows keep their original order for the page's lifetime. Expiry collapses the remaining row before detaching it. Failed removal expands the original row with Remove feedback; failed restoration keeps Undo available for retry. Navigation clears local rows, timers, and queued restores. Reduced-motion preferences disable the animations.
- Failure feedback remains visible independently of animation events, including with reduced motion. Enhanced cart failures use button feedback and inline field errors; document failures also show contextual error messages after the redirect.
- Removing a focused cart row moves focus to Undo. Expiry moves focus to the cart region, including when the cart becomes empty; restoration returns focus to Remove.

## Development

- `pnpm dev` restarts the server when source files change.
- `pnpm hmr` enables hot module replacement for browser components and reloads frames after server updates.
- Development keeps asset URLs stable and revalidates changed files.
- `pnpm dev` sets `DELAY=1` to enable the `simulateLatency()` middleware for requests with `X-Remix-Frame: true`. It delays non-asset frame GET requests by a random 100–300 ms and other frame methods, including POST, by 250–750 ms to demonstrate pending and optimistic UI. About 10% of frame POST, PUT, PATCH, and DELETE requests receive a simulated 503 response before their handlers run. Other startup commands can opt in with `DELAY=1`; tests always bypass the middleware. Document requests, static files, asset-server requests, and uploaded files bypass both the delay and simulated failures. PendingButton's failure feedback keeps its separate two-second timer.
- `pnpm test` runs the demo's tests, and `pnpm typecheck` checks its TypeScript types.

### Database Commands

The setup command above creates `db/record-store.sqlite`, applies the migrations, and loads the sample catalog and accounts. You can manage it with:

```sh
pnpm db:status
pnpm db:migrate
pnpm db:rollback
pnpm db:seed
pnpm db:reset
```

`db:rollback` reverts the latest migration, while `db:reset` recreates the database from scratch. The other commands let you inspect or update it without discarding your local changes.

## Explore the Code

- [Routes](https://github.com/remix-run/remix/blob/main/demos/record-store/app/routes.ts) and [router](https://github.com/remix-run/remix/blob/main/demos/record-store/app/router.ts): URL definitions and middleware.
- [Records](https://github.com/remix-run/remix/tree/main/demos/record-store/app/actions/albums), [cart](https://github.com/remix-run/remix/tree/main/demos/record-store/app/actions/cart), and [checkout](https://github.com/remix-run/remix/tree/main/demos/record-store/app/actions/checkout): storefront flows.
- [Auth](https://github.com/remix-run/remix/tree/main/demos/record-store/app/actions/auth), [account](https://github.com/remix-run/remix/tree/main/demos/record-store/app/actions/account), and [admin](https://github.com/remix-run/remix/tree/main/demos/record-store/app/actions/admin): customer and store management.
- [Shared UI](https://github.com/remix-run/remix/tree/main/demos/record-store/app/ui) and [data schema](https://github.com/remix-run/remix/blob/main/demos/record-store/app/data/schema.ts): reusable components and database tables.
