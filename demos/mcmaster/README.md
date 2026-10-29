# McMaster-Carr Speed Demo

[McMaster-Carr](https://www.mcmaster.com/) is famous for feeling instant, even though it sells about 595,000 products. This demo rebuilds that experience with Remix at the same scale: 594,502 generated parts in 22 families and 193 sub-families that you can browse by category, filter by spec, and add to an order.

None of McMaster's techniques are new. The demo shows how each one maps onto plain Remix APIs, and it includes a Speed HUD that lets you turn them all off to feel the difference.

## Run It

```sh
cd demos/mcmaster
pnpm install
pnpm start
```

Visit [http://localhost:44100](http://localhost:44100). The catalog is generated into an in-memory SQLite database at startup, which takes about two seconds, so there is nothing to set up.

`pnpm start` runs in production mode with minified, fingerprinted assets. Use `pnpm dev` for automatic restarts while editing.

## Try It

1. Pick **300 ms** of simulated latency in the Speed HUD and click **Apply**. Localhost responds in about a millisecond, which hides the round trips these techniques are designed to avoid.
2. Hover a family link, then click it. The HUD reports a content-frame swap in a few milliseconds, served from the HTTP cache because hovering already loaded it.
3. Filter a family by spec. Each filter link prefetches on hover too, so filtering feels instant.
4. Switch the speed techniques **Off** and browse again. Every click is now a full document load that pays the latency, downloads the uncompressed page, and caches nothing.

The HUD keeps your last few page loads in `sessionStorage`, so you can compare runs side by side.

## How It Works

| McMaster technique             | How this demo does it                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A shell that stays put         | McMaster sends the same small shell for every URL, then fetches each page's content into it with JavaScript. Here every page is rendered by [`render()`](https://github.com/remix-run/remix/tree/main/packages/render-middleware) middleware, so the first load already contains the content and works without JavaScript. JavaScript only hydrates the HUD, the add-to-order form, and the title. |
| Prefetch on hover              | Links use `data-rmx-prefetch="intent"`, which starts loading a page 100ms after the pointer or focus rests on it ([`app/ui/catalog-link.tsx`](app/ui/catalog-link.tsx)).                                                                                                                                                                                                                           |
| Swap only the content area     | The layout renders `<Frame name="content">`. Links use `data-rmx-target="content"`, and pages return only their content when a request has `X-Remix-Target: content` ([`app/actions/render-page.tsx`](app/actions/render-page.tsx)).                                                                                                                                                               |
| Cacheable pages, private shell | Content responses use `Cache-Control: public, max-age=300, stale-while-revalidate=86400` so browsers and CDNs can reuse them. The cart summary lives in its own `no-store` frame, so it never makes the catalog personal.                                                                                                                                                                          |
| Cheap revalidation             | Documents use `private, no-cache`. [`app/middleware/conditional-get.ts`](app/middleware/conditional-get.ts) answers unchanged pages with an empty `304` before loading any data.                                                                                                                                                                                                                   |
| Inline critical CSS            | Every style uses the `css()` mixin, which Remix collects into one `<style>` in the page head, including styles inside frames. There is no stylesheet request to block rendering.                                                                                                                                                                                                                   |
| Optimized product photos       | Each family and sub-family has one source photo. The asset server resizes it to the exact size each page needs, converts it to WebP, and caches it on disk ([`app/utils/assets.ts`](app/utils/assets.ts)). Every image has fixed dimensions, and thumbnails further down the page load lazily.                                                                                                     |
| Prefetch images too            | Family and part pages declare their first photo with `<link rel="preload" as="image">`. When hovering prefetches a page's HTML, Remix finds that preload and downloads the photo as well, so it is often cached before you click.                                                                                                                                                                  |
| Long-lived assets              | In production the asset server fingerprints URLs and serves them with `Cache-Control: public, max-age=31536000, immutable`.                                                                                                                                                                                                                                                                        |
| Compression                    | The `compression()` middleware applies Brotli or gzip to every response.                                                                                                                                                                                                                                                                                                                           |
| Few requests                   | The document preloads its modules, uses an empty icon to skip `/favicon.ico`, and uses system fonts instead of web fonts.                                                                                                                                                                                                                                                                          |

## How This Compares

The demo matches McMaster's scale so its speed is not just the result of a smaller site. These are the socket head screws family pages, measured with an empty cache in October 2026:

|                     | McMaster-Carr | This demo |
| ------------------- | ------------- | --------- |
| Products in catalog | ~595,000      | 594,502   |
| Elements on page    | 3,271         | 3,128     |
| Images on page      | 12            | 10        |
| Requests            | 37            | 74        |
| Transferred         | 1,446 KB      | ~94 KB    |

The page content is comparable; the difference in bytes is mostly McMaster's JavaScript and web fonts. The demo makes more requests because the asset server serves the client runtime as small, separately cached modules rather than one bundle.

Each family page shows a section per sub-family with its own photo and the first 30 matching parts, like McMaster's "presentations". Choosing a sub-family shows up to 300 of its parts, and the filters narrow the rest. Filter counts come from grouped SQL queries ([`app/actions/catalog/family-filters.ts`](app/actions/catalog/family-filters.ts)) that take up to about 80 ms for the largest families. Content responses are cached publicly for five minutes, so a CDN or the browser absorbs that work for repeat visits, the same trade McMaster makes.

The catalog is generated, so every spec combination exists. A real catalog would be sparser.

### Why there are no image sprites

McMaster still combines its small category photos into sprite sheets, which made sense when every request needed its own connection. HTTP/2 and HTTP/3 send many files over one connection, so this demo serves each photo as its own small, permanently cached file instead. That keeps each page's image bytes limited to the images it shows.

Preloaded images use a single 2x URL instead of `srcset`, because Remix's prefetch discovery skips preloads that list several candidates ([`app/actions/product-images.ts`](app/actions/product-images.ts)).

### Product photos

The photos in [`app/images/products`](app/images/products) were generated with the OpenAI Images API, so they are not copied from any store. Each family has a photo, and each sub-family has one in a folder named after its family. A sub-family without its own photo uses the family's. To regenerate photos, edit the `photo` descriptions in [`app/data/catalog.ts`](app/data/catalog.ts) and run:

```sh
OPENAI_API_KEY=... pnpm images:generate --force --only hex-nuts --only o-rings/viton
```

The script skips existing images unless you pass `--force`, and respects `OPENAI_BASE_URL` for OpenAI-compatible proxies.

### Why the ETags describe inputs, not bodies

Remix gives each render unique hydration and frame IDs, so two renders of the same page never hash to the same bytes. Instead, `conditionalGet()` builds the ETag from the things that determine a page: a per-process deployment ID, the URL, the requested frame, and the visitor's cookies. Knowing the ETag up front means a match skips rendering entirely, and successful responses can still stream.

### Simulated latency

[`app/utils/simulated-latency.ts`](app/utils/simulated-latency.ts) wraps the server's request handler rather than adding router middleware. That keeps the delay at the network boundary, so the frame requests `render()` makes internally while building a document are not delayed again.

### Speed techniques off

With the techniques off, [`app/middleware/speed-settings.ts`](app/middleware/speed-settings.ts) skips compression and marks every response `no-store`, links render without prefetch hints, and [`app/actions/public/entry.tsx`](app/actions/public/entry.tsx) stops Remix from intercepting navigations so each click loads a full document. Assets your browser already cached as `immutable` stay cached; clear the cache for a cold comparison.

## Explore the Code

- [`app/routes.ts`](app/routes.ts) and [`app/router.ts`](app/router.ts) show the route contract and the middleware order.
- [`app/actions/catalog`](app/actions/catalog) contains the category, family, and part pages, plus [`family-filters.ts`](app/actions/catalog/family-filters.ts), which narrows parts by the spec values in the URL.
- [`app/actions/cart`](app/actions/cart) and [`app/actions/fragments`](app/actions/fragments) implement the order and the cart summary frame. The add-to-order form works without JavaScript and, once hydrated, posts in the background and reloads only the cart summary.
- [`app/data/catalog.ts`](app/data/catalog.ts) defines the catalog, and [`app/data/setup.ts`](app/data/setup.ts) expands every combination of sub-family, spec values, and pack size into orderable parts, storing totals like part counts and lowest prices as it goes.
- [`app/ui/product-image.tsx`](app/ui/product-image.tsx) and [`app/actions/product-images.ts`](app/actions/product-images.ts) render and resolve the product photos.
- [`app/ui/public/speed-hud.tsx`](app/ui/public/speed-hud.tsx) measures navigations with the Navigation API and Resource Timing.

## Tests

```sh
pnpm test
```

Server tests cover the caching contract, filters, and cart. End-to-end tests in [`app/speed.test.e2e.ts`](app/speed.test.e2e.ts) check that hovering prefetches a page, that clicking reuses it without re-rendering the shell, and that turning the techniques off falls back to full document loads.
