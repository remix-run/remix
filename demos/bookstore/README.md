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

The production server enables minification and asset fingerprinting. Catalog images live in `app/images` and are served through the asset server at `/assets/app/images/…` with content fingerprints and `Cache-Control: public, max-age=31536000, immutable`. Catalog and product pages share the original images. Development uses stable image URLs with `no-cache` and ETags. Stored catalog paths are resolved when rendering, so an existing database does not need to be reseeded. Uploaded covers continue to use `/uploads/…`.

HTML responses use `csp()` with a nonce shared by the document script, module preloads, import maps, and generated CSS. The import-map polyfill's blob imports inherit the module graph's nonce, so the policy does not need an explicit `blob:` script source. The policy blocks unnonced inline scripts, style attributes, plugins, and embedding the bookstore. During HMR, it allows connections to the event channel's origin. The carousel uses `css()` instead of a style attribute.

The demo shows two built-in prefetch triggers. Header navigation links use Remix's `data-rmx-prefetch="intent"` behavior; Login is excluded because rendering it consumes flash messages. Book cards use `data-rmx-prefetch="viewport"` on their “View Details” links. Remix starts prefetching when those links enter the viewport and tracks links added or changed during frame navigation and client rendering. Each link is prefetched once while mounted with the same destination; leaving and reentering the viewport does not repeat it. Browsers without `IntersectionObserver` skip viewport prefetching. Book detail pages declare `<link rel="preload" as="image">` for the main product image so Remix's HTML discovery also prefetches it before navigation. The remaining carousel images use `loading="lazy"`.

The home, books, genre, search, about, contact, and registration pages use `Cache-Control: private, max-age=30` for successful GET frame requests so a navigation can reuse prefetched HTML for 30 seconds. Full document requests to those pages use `no-store`. Cacheable frame responses vary by cookie and frame headers to keep personalized and document/frame variants separate. Cart documents, frames, and fragments explicitly use `no-store`. Checkout, account, and the other auth handlers do not opt into this cache window; ordinary navigations can show cached cart counts for up to 30 seconds.

The [browser entry](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/actions/public/entry.tsx) delegates to `defaultResolveFrame` with a `fetch` override that sets `cache: 'force-cache'` for `options.transition?.navigationType === 'traverse'`. Back/Forward can reuse browsing HTML past its 30-second freshness window, including older cart counts. Other loads use the default Fetch cache mode, and `no-store` responses still require a network request.

## View Transitions

Click a book cover on the homepage or catalog, then use Back and Forward. The cover and title move and resize into the product image and heading, and return to their card on Back. Shared book animations run when either end of the navigation is a product page; navigating between lists uses only the page slide and fade. The header and footer stay steady. These transitions apply to push, replace, and traverse navigations, including followed redirects.

The [browser entry](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/actions/public/entry.tsx) also supplies a `commit` override that passes `commitFrame` to `document.startViewTransition()`. The snapshot includes the rendered destination and final scroll position, including after redirects. The hook skips a cancelled animation. Named subframes, browser reloads, independent updates, reduced motion, and browsers without view transitions use the default commit directly.

The shared [book transition mixins](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/ui/book-transitions.ts) give each card and product page matching cover and title names with `bookCoverTransition(book.id)` and `bookTitleTransition(book.id)`. These names apply only during a `book-details` view transition, which the commit hook selects by matching `transition.from.url` or its redirect-aware `to` against the product route. Browsers without view transition types use the page animation alone. The mixins' `viewTransitionClass` values share animation styles across books. The [layout](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/ui/layout.tsx) names its `main` element `bookstore-page`, and the [stylesheet](https://github.com/remix-run/remix/blob/main/demos/bookstore/app/actions/public/app.css) defines the transition pseudo-elements, keyframes, and reduced-motion rules.

Each book's transition names must be unique within a page. The demo preloads the main product image but does not wait for it to decode. See [Wrapping Frame Commits](https://github.com/remix-run/remix/tree/main/packages/component#wrapping-frame-commits) for handling duplicate books and waiting for destination images without blocking on lazy carousel images.

Cart quantity updates and removals use separate GET, POST, and DELETE handlers at `/cart/items`. Each mutation handler parses the shared experimental form schema before passing typed data to the cart API helper. Each row has separate form contexts for quantity and removal; the form mixins derive native constraints and connect quantity feedback to its input. Rejected frame submissions restore the entered quantity and show the server validation message on the submitted row. Native forms redirect back to `/cart` on success and failure. On failure, the custom `flashUntilRead()` middleware stores the submitted values and errors in the session until the nested cart frame reads them. The controller restores that feedback with `fd.submissionSchema(CartItemUpdateForm)`, deriving its shape from the existing form definition. The document and frame share the same inline error UI; a subsequent page reload restores the saved quantity without those errors. This handoff uses the demo's server-side session storage so the nested frame can persist the read without changing the document's cookie. With JavaScript, forms call `handle.frame.reload({ method: 'post', body: new FormData(form, submitter) })`; the frame submits to its unchanged source and receives updated HTML in one request. Removal includes `_method=DELETE`, which the existing method override middleware routes to the DELETE handler. The frame's `reloadStart` metadata drives pending UI. Rows stay visible with a `Removing...` button until the server confirms removal. The total and the updating row's subtotal keep their saved amounts visible, faded with a small spinner until the server returns confirmed pricing. Failed reloads restore the previous quantity, keep the item available for retry, and offer a GET reload to check what was saved. Focus stays on the removal button while pending, then moves to the cart region when the focused row is removed, including the final empty state.

## Explore the Code

- Start with [`app/routes.ts`](app/routes.ts) and [`app/router.ts`](app/router.ts) to see the typed route contract and the middleware stack, including the standard UI render middleware.
- Follow the storefront through [`app/actions/books`](app/actions/books), [`app/actions/cart`](app/actions/cart), and [`app/actions/checkout`](app/actions/checkout). These flows work on the server first, then add richer browser behavior where it helps.
- Look in [`app/actions/auth`](app/actions/auth), [`app/actions/account`](app/actions/account), and [`app/actions/admin`](app/actions/admin) for nested controllers, sessions, authorization, CRUD, and file uploads.
- [`app/ui`](app/ui) contains the shared document and layout pieces. Colocated `public` directories contain the browser code for cart fragments and the image carousel.
- Data-entry forms define inspectable schemas with `remix/data-schema/experimental/form` and parse server submissions with `fd.parseSafe(schema, data)`. Each browser form uses `form.Context` from `@remix-run/ui/form` and the shared `app/ui/public/field.tsx` component for labels, controls, and errors. The controller passes a failed submission back to the form so typed values and validation messages survive a server round trip.
- [`app/data/schema.ts`](app/data/schema.ts), [`db/migrations`](db/migrations), and [`remix.json`](remix.json) show the typed SQLite schema and the `remix db` workflow.

## Database Commands

The setup command above creates `db/bookstore.sqlite`, applies the migrations, and loads the sample catalog and accounts. You can manage it with:

```sh
pnpm db:status
pnpm db:migrate
pnpm db:rollback
pnpm db:seed
pnpm db:reset
```

`db:rollback` reverts the latest migration, while `db:reset` recreates the database from scratch. The other commands let you inspect or update it without discarding your local changes.
